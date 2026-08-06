"""Generate and load the compact Ask Basis data card."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.models import CanonicalOffer, RawObservation

DATA_CARD_PATH: Final = Path(__file__).with_name("data_card.json")
_SCHEMA_NAMES: Final = (
    "raw_observations",
    "canonical_offers",
    "daily_aggregates",
    "basis_decomposition",
    "doc_chunks",
)


@dataclass(frozen=True)
class DataCard:
    """Index-time snapshot of the dataset surface available to Ask Basis."""

    generated_at: str
    raw_observation_count: int
    canonical_offer_count: int
    corpus_start: str | None
    corpus_end: str | None
    providers: tuple[tuple[str, str], ...]
    top_skus: tuple[tuple[str, int], ...]
    sku_list: tuple[str, ...]
    schema_names: tuple[str, ...]
    text: str


async def generate_data_card(session: AsyncSession) -> DataCard:
    """Build the data card from the same database indexed by ``run_index.py``."""
    raw_observation_count = int(
        (await session.execute(select(func.count(RawObservation.id)))).scalar_one()
    )
    canonical_offer_count = int(
        (await session.execute(select(func.count(CanonicalOffer.id)))).scalar_one()
    )
    bounds = (
        await session.execute(
            select(
                func.min(CanonicalOffer.collected_at).label("corpus_start"),
                func.max(CanonicalOffer.collected_at).label("corpus_end"),
            )
        )
    ).one()
    sku_list = tuple(
        (
            await session.execute(
                select(CanonicalOffer.gpu_sku_canonical)
                .distinct()
                .order_by(CanonicalOffer.gpu_sku_canonical)
            )
        )
        .scalars()
        .all()
    )
    providers = tuple(
        (str(row.provider), row.joined.date().isoformat())
        for row in (
            await session.execute(
                select(
                    CanonicalOffer.provider,
                    func.min(CanonicalOffer.collected_at).label("joined"),
                )
                .group_by(CanonicalOffer.provider)
                .order_by(CanonicalOffer.provider)
            )
        ).all()
    )
    top_skus = tuple(
        (str(row.gpu_sku_canonical), int(row.offer_count))
        for row in (
            await session.execute(
                select(
                    CanonicalOffer.gpu_sku_canonical,
                    func.count(CanonicalOffer.id).label("offer_count"),
                )
                .group_by(CanonicalOffer.gpu_sku_canonical)
                .order_by(func.count(CanonicalOffer.id).desc(), CanonicalOffer.gpu_sku_canonical)
                .limit(12)
            )
        ).all()
    )
    corpus_start = _iso_date(bounds.corpus_start)
    corpus_end = _iso_date(bounds.corpus_end)
    text = render_data_card_summary(
        raw_observation_count=raw_observation_count,
        canonical_offer_count=canonical_offer_count,
        corpus_start=corpus_start,
        corpus_end=corpus_end,
        providers=providers,
        top_skus=top_skus,
        total_skus=len(sku_list),
    )
    return DataCard(
        generated_at=datetime.now(UTC).isoformat(),
        raw_observation_count=raw_observation_count,
        canonical_offer_count=canonical_offer_count,
        corpus_start=corpus_start,
        corpus_end=corpus_end,
        providers=providers,
        top_skus=top_skus,
        sku_list=sku_list,
        schema_names=_SCHEMA_NAMES,
        text=text,
    )


def write_data_card(data_card: DataCard, path: Path = DATA_CARD_PATH) -> None:
    """Persist a generated data card beside the RAG package."""
    payload = asdict(data_card)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def load_data_card(path: Path = DATA_CARD_PATH) -> DataCard:
    """Load the index-time data card; serving never reconstructs it ad hoc."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    return DataCard(
        generated_at=str(payload["generated_at"]),
        raw_observation_count=int(payload["raw_observation_count"]),
        canonical_offer_count=int(payload["canonical_offer_count"]),
        corpus_start=payload.get("corpus_start"),
        corpus_end=payload.get("corpus_end"),
        providers=tuple((str(name), str(date)) for name, date in payload["providers"]),
        top_skus=tuple((str(name), int(count)) for name, count in payload["top_skus"]),
        sku_list=tuple(payload["sku_list"]),
        schema_names=tuple(payload["schema_names"]),
        text=str(payload["text"]),
    )


def _iso_date(value: datetime | None) -> str | None:
    return value.date().isoformat() if value is not None else None


def render_data_card_summary(
    *,
    raw_observation_count: int,
    canonical_offer_count: int,
    corpus_start: str | None,
    corpus_end: str | None,
    providers: tuple[tuple[str, str], ...],
    top_skus: tuple[tuple[str, int], ...],
    total_skus: int,
) -> str:
    """Render the orientation summary injected into every model request."""
    provider_text = ", ".join(f"{name} (since {joined})" for name, joined in providers)
    # Counts remain in JSON metadata; the injected orientation card needs only
    # their count-derived order to stay inside the fixed 300-token budget.
    sku_text = ", ".join(sku for sku, _count in top_skus)
    remaining = max(0, total_skus - len(top_skus))
    return "\n".join(
        (
            "Basis is a public-data study of GPU compute price fungibility across cloud providers.",
            (
                f"Corpus: {raw_observation_count:,} raw observations; "
                f"{canonical_offer_count:,} canonical offers; "
                f"{corpus_start or 'unknown'} through {corpus_end or 'unknown'}."
            ),
            f"Providers: {provider_text or 'none indexed'}.",
            f"Top SKUs by canonical-offer count: {sku_text or 'none indexed'}.",
            f"…and {remaining} more SKUs; ask about any specific one.",
            f"Database schemas: {', '.join(_SCHEMA_NAMES)}.",
            "Numbers in documents may be stale; prefer tools for current values.",
        )
    )
