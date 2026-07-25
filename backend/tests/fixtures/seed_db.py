"""Migrate and seed a fresh Postgres database with the deterministic test fixture."""

from __future__ import annotations

import asyncio
import datetime
import json
import re
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from sqlalchemy import func, insert, select, text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

from basis.config import settings
from basis.db.models import (
    BasisDecomposition,
    CanonicalOffer,
    DailyAggregate,
    RawObservation,
)

BACKEND_DIR = Path(__file__).resolve().parents[2]
FIXTURE_DIR = Path(__file__).resolve().parent / "db"

TABLE_FIXTURES = (
    (RawObservation.__table__, FIXTURE_DIR / "raw_observations.jsonl"),
    (CanonicalOffer.__table__, FIXTURE_DIR / "canonical_offers.jsonl"),
    (DailyAggregate.__table__, FIXTURE_DIR / "daily_aggregates.jsonl"),
    (BasisDecomposition.__table__, FIXTURE_DIR / "basis_decomposition.jsonl"),
)

SECRET_PATTERN = re.compile(
    r"api[_-]?key|secret|token|password|authorization|credential|bearer",
    re.IGNORECASE,
)


def _load_jsonl(
    path: Path,
    converters: dict[str, Callable[[str], object]],
) -> list[dict[str, Any]]:
    """Load one fixture file and convert date/time strings for asyncpg."""
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as fixture_file:
        for line_number, line in enumerate(fixture_file, start=1):
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number}: invalid JSON") from exc
            for field, converter in converters.items():
                row[field] = converter(row[field])
            rows.append(row)
    if not rows:
        raise ValueError(f"{path} is empty")
    return rows


def _parse_utc_datetime(value: str) -> datetime.datetime:
    parsed = datetime.datetime.fromisoformat(value)
    if parsed.utcoffset() != datetime.timedelta(0):
        raise ValueError(f"Fixture timestamp is not UTC: {value}")
    return parsed


def _parse_date(value: str) -> datetime.date:
    return datetime.date.fromisoformat(value)


def _load_fixture_rows() -> dict[str, list[dict[str, Any]]]:
    raw_rows = _load_jsonl(
        FIXTURE_DIR / "raw_observations.jsonl",
        {"collected_at": _parse_utc_datetime},
    )
    canonical_rows = _load_jsonl(
        FIXTURE_DIR / "canonical_offers.jsonl",
        {"collected_at": _parse_utc_datetime},
    )
    aggregate_rows = _load_jsonl(
        FIXTURE_DIR / "daily_aggregates.jsonl",
        {"date": _parse_date},
    )
    decomposition_rows = _load_jsonl(
        FIXTURE_DIR / "basis_decomposition.jsonl",
        {"date": _parse_date},
    )

    raw_ids = {row["id"] for row in raw_rows}
    missing_raw_ids = {
        row["raw_observation_id"] for row in canonical_rows
    } - raw_ids
    if missing_raw_ids:
        preview = sorted(missing_raw_ids)[:5]
        raise ValueError(f"Canonical fixture references missing raw IDs: {preview}")

    providers = {row["provider"] for row in canonical_rows}
    expected_providers = {"aws_spot", "runpod", "tensordock", "vast"}
    if providers != expected_providers:
        raise ValueError(
            f"Fixture providers differ from expected set: {sorted(providers)}"
        )

    dates = {row["collected_at"].date() for row in canonical_rows}
    skus = {row["gpu_sku_canonical"] for row in canonical_rows}
    if len(dates) < 5 or len(skus) < 5 or "h100_sxm_80gb" not in skus:
        raise ValueError(
            "Fixture must span at least five UTC dates and five SKUs, "
            "including h100_sxm_80gb"
        )

    if any(row["price_hourly"] <= 0 for row in raw_rows):
        raise ValueError("Raw fixture contains a non-positive hourly price")
    if any(row["price_usd_per_hour"] <= 0 for row in canonical_rows):
        raise ValueError("Canonical fixture contains a non-positive hourly price")

    for row in raw_rows:
        if SECRET_PATTERN.search(json.dumps(row["raw_payload"])):
            raise ValueError(
                f"Raw fixture row {row['id']} contains secret-like payload data"
            )
        if SECRET_PATTERN.search(json.dumps(row["provider_metadata"])):
            raise ValueError(
                f"Raw fixture row {row['id']} contains secret-like provider metadata"
            )

    canonical_pairs = {
        (row["collected_at"].date(), row["gpu_sku_canonical"])
        for row in canonical_rows
    }
    aggregate_pairs = {(row["date"], row["gpu_sku"]) for row in aggregate_rows}
    decomposition_pairs = {
        (row["date"], row["gpu_sku"]) for row in decomposition_rows
    }
    if not canonical_pairs <= aggregate_pairs:
        raise ValueError("Daily aggregate fixture does not cover every date/SKU pair")
    if not canonical_pairs <= decomposition_pairs:
        raise ValueError("Decomposition fixture does not cover every date/SKU pair")

    return {
        "raw_observations": raw_rows,
        "canonical_offers": canonical_rows,
        "daily_aggregates": aggregate_rows,
        "basis_decomposition": decomposition_rows,
    }


def _run_migrations() -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(BACKEND_DIR / "alembic.ini"),
            "upgrade",
            "head",
        ],
        cwd=BACKEND_DIR,
        check=True,
    )


async def _assert_tables_empty(connection: AsyncConnection) -> None:
    populated: list[str] = []
    for table, _ in TABLE_FIXTURES:
        count = (
            await connection.execute(select(func.count()).select_from(table))
        ).scalar_one()
        if count:
            populated.append(f"{table.name}={count}")
    if populated:
        raise RuntimeError(
            "Refusing to seed non-empty fixture tables: " + ", ".join(populated)
        )


async def _seed() -> None:
    fixture_rows = _load_fixture_rows()
    engine = create_async_engine(settings.database_url)
    try:
        async with engine.begin() as connection:
            await _assert_tables_empty(connection)
            for table, _ in TABLE_FIXTURES:
                await connection.execute(insert(table), fixture_rows[table.name])
                await connection.execute(
                    text(
                        "SELECT setval("
                        f"pg_get_serial_sequence('{table.name}', 'id'), "
                        f"(SELECT MAX(id) FROM {table.name}), true)"
                    )
                )
    finally:
        await engine.dispose()

    counts = ", ".join(
        f"{table.name}={len(fixture_rows[table.name])}"
        for table, _ in TABLE_FIXTURES
    )
    print(f"Seeded deterministic fixture: {counts}")


def main() -> None:
    _run_migrations()
    asyncio.run(_seed())


if __name__ == "__main__":
    main()
