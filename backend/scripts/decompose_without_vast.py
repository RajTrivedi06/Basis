"""Robustness check: H100 SXM 80GB residual share with Vast.ai excluded.

One-off analysis script. Pulls canonical_offers for the SKU across the
EC2-cutover-to-now window, runs the production decomposition with and
without Vast offers, and prints per-day pct_residual + medians.

Vast accounts for ~80% of all canonical offers, so the headline residual
is implicitly Vast-weighted. If excluding Vast moves the median by more
than a few percentage points, that's a methodology caveat for findings.md.

Run from repo root:
    PGPASSWORD=$(...) DB_HOST=127.0.0.1 DB_PORT=5434 \\
        uv run python backend/scripts/decompose_without_vast.py
"""

from __future__ import annotations

import asyncio
import os
import statistics
import sys
from datetime import date
from pathlib import Path

# Allow `from basis.…` whether run as `python scripts/…py` or `python -m`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncpg
import pandas as pd

from basis.analytics.basis import compute_decompositions

GPU_SKU = "h100_sxm_80gb"
# Window is env-driven so each refresh reruns without editing the file.
# SINCE stays pinned to the EC2 cutover (2026-04-26); UNTIL defaults to today.
SINCE = date.fromisoformat(os.environ.get("SINCE", "2026-04-26"))
UNTIL = (
    date.fromisoformat(os.environ["UNTIL"])
    if os.environ.get("UNTIL")
    else date.today()
)


async def fetch_offers() -> pd.DataFrame:
    conn = await asyncpg.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", "5434")),
        user=os.environ.get("DB_USER", "basis"),
        database=os.environ.get("DB_NAME", "basis"),
        password=os.environ["PGPASSWORD"],
    )
    try:
        rows = await conn.fetch(
            """
            SELECT DATE(collected_at) AS date,
                   gpu_sku_canonical,
                   provider,
                   commitment_type,
                   region_country,
                   vcpus_bundled,
                   ram_gb_bundled,
                   storage_gb_bundled,
                   price_usd_per_hour
            FROM canonical_offers
            WHERE gpu_sku_canonical = $1
              AND DATE(collected_at) BETWEEN $2 AND $3
            """,
            GPU_SKU,
            SINCE,
            UNTIL,
        )
    finally:
        await conn.close()

    return pd.DataFrame([dict(r) for r in rows])


def pct_residual(rows: list) -> dict[date, float]:
    out: dict[date, float] = {}
    for r in rows:
        if r.total_variance > 0:
            out[r.date] = r.residual_variance / r.total_variance * 100.0
    return out


def main() -> None:
    df = asyncio.run(fetch_offers())
    print(f"Loaded {len(df):,} canonical offers for {GPU_SKU}")

    full = compute_decompositions(df)
    no_vast_df = df[df["provider"] != "vast"].copy()
    no_vast = compute_decompositions(no_vast_df)

    full_pct = pct_residual(full)
    nv_pct = pct_residual(no_vast)

    print("\n  date       full   no_vast   delta   n_full  n_no_vast")
    print("  ---------- -----  -------  ------   ------  ---------")
    all_dates = sorted(set(full_pct) | set(nv_pct))
    for d in all_dates:
        f = full_pct.get(d)
        nv = nv_pct.get(d)
        n_f = int((df["date"] == d).sum())
        n_nv = int((no_vast_df["date"] == d).sum())
        f_str = f"{f:5.1f}" if f is not None else "  -- "
        nv_str = f"{nv:5.1f}" if nv is not None else "  -- "
        if f is not None and nv is not None:
            delta = nv - f
            d_str = f"{delta:+5.1f}"
        else:
            d_str = "   -- "
        print(f"  {d}  {f_str}    {nv_str}    {d_str}   {n_f:>5}    {n_nv:>5}")

    full_vals = list(full_pct.values())
    nv_vals = list(nv_pct.values())
    print(
        "\nFull dataset    : "
        f"n={len(full_vals)}  mean={statistics.mean(full_vals):.2f}  "
        f"median={statistics.median(full_vals):.2f}  "
        f"std={statistics.pstdev(full_vals):.2f}"
    )
    print(
        "Vast excluded   : "
        f"n={len(nv_vals)}  mean={statistics.mean(nv_vals):.2f}  "
        f"median={statistics.median(nv_vals):.2f}  "
        f"std={statistics.pstdev(nv_vals):.2f}"
    )
    print(
        "\nMedian shift (no_vast - full): "
        f"{statistics.median(nv_vals) - statistics.median(full_vals):+.2f} pp"
    )


if __name__ == "__main__":
    main()
