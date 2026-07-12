"""Diagnostic probe for the Vast.ai collection collapse (2026-06-23).

Vast's total daily collection dropped ~97% (~6,400 → ~220 offers/day) on
2026-06-23, which zeroed the (expensive, cheapest-sorted-last) H100 tier.
~220/day ≈ the API's default page size, so our ``limit:10000`` appears to no
longer be honored. This script replays the collector's exact request and a set
of variants side by side to pin down *why* — a query-format change vs. a new
cap on keyless requests vs. an IP-level throttle.

Read-only: issues GETs/POSTs to the public Vast API, writes nothing.

Run on EC2 (same network path as the real collector — important, since an
IP-scoped throttle would only reproduce there):
    uv run python backend/scripts/probe_vast_api.py
Optionally set VAST_API_KEY to test whether auth lifts the cap:
    VAST_API_KEY=xxxx uv run python backend/scripts/probe_vast_api.py
"""

from __future__ import annotations

import asyncio
import json
import os

import httpx

BUNDLES_URL = "https://console.vast.ai/api/v0/bundles/"
SEARCH_URL = "https://console.vast.ai/api/v0/search/asks/"  # newer Vast search endpoint

# The collector's exact on-demand query (vast.py:128).
CURRENT_Q = {
    "rentable": {"eq": True},
    "order": [["dph_total", "asc"]],
    "type": "on-demand",
    "limit": 10000,
}


def _summarize(data: dict) -> str:
    """One-line summary of a Vast response: offer count, H100 presence, price span."""
    offers = data.get("offers", []) if isinstance(data, dict) else []
    n = len(offers)
    gpu_names = {o.get("gpu_name") for o in offers if o.get("gpu_name")}
    h100 = sorted(g for g in gpu_names if g and "H100" in g)
    dphs = [o.get("dph_total") for o in offers if isinstance(o.get("dph_total"), (int, float))]
    span = f"${min(dphs):.2f}-${max(dphs):.2f}" if dphs else "n/a"
    top_keys = list(data.keys())[:8] if isinstance(data, dict) else type(data).__name__
    return (
        f"n={n:<6} H100={h100 or '—'}  dph_span={span}  "
        f"distinct_gpus={len(gpu_names)}  resp_keys={top_keys}"
    )


async def _probe(client: httpx.AsyncClient, label: str, coro) -> None:
    try:
        resp = await coro
        status = resp.status_code
        try:
            data = resp.json()
        except Exception:
            print(f"[{label}] HTTP {status}  <non-JSON body, first 200 chars>: {resp.text[:200]!r}")
            return
        print(f"[{label}] HTTP {status}  {_summarize(data)}")
    except httpx.HTTPStatusError as exc:
        print(f"[{label}] HTTP {exc.response.status_code}  body[:200]={exc.response.text[:200]!r}")
    except Exception as exc:  # diagnostic script: report anything and keep going
        print(f"[{label}] ERROR {type(exc).__name__}: {exc}")


async def main() -> None:
    key = os.environ.get("VAST_API_KEY")
    auth_headers = {"Authorization": f"Bearer {key}"} if key else {}
    print(f"VAST_API_KEY set: {bool(key)}\n")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Exact current collector request (GET, q as URL param, limit inside q).
        await _probe(
            client, "1 current (GET q, limit=10000)",
            client.get(BUNDLES_URL, params={"q": json.dumps(CURRENT_Q)}),
        )

        # 2. Same query with NO limit field → reveals the server default page size.
        q_no_limit = {k: v for k, v in CURRENT_Q.items() if k != "limit"}
        await _probe(
            client, "2 no-limit (GET q)",
            client.get(BUNDLES_URL, params={"q": json.dumps(q_no_limit)}),
        )

        # 3. Much larger limit → is `limit` scaled at all, or hard-capped?
        q_big = {**CURRENT_Q, "limit": 100000}
        await _probe(
            client, "3 limit=100000 (GET q)",
            client.get(BUNDLES_URL, params={"q": json.dumps(q_big)}),
        )

        # 4. limit as a sibling URL param instead of inside q.
        await _probe(
            client, "4 limit as URL param",
            client.get(BUNDLES_URL, params={"q": json.dumps(q_no_limit), "limit": "10000"}),
        )

        # 5. POST with the query in the JSON body (vast CLI's newer style).
        await _probe(
            client, "5 POST body (bundles)",
            client.post(BUNDLES_URL, json=CURRENT_Q, headers=auth_headers),
        )

        # 6. Newer search endpoint, PUT with body.
        await _probe(
            client, "6 PUT search/asks",
            client.put(SEARCH_URL, json=CURRENT_Q, headers=auth_headers),
        )

        # 7. Current request WITH auth header (only meaningful if VAST_API_KEY set).
        if key:
            await _probe(
                client, "7 current + auth header",
                client.get(BUNDLES_URL, params={"q": json.dumps(CURRENT_Q)}, headers=auth_headers),
            )

    print(
        "\nRead: if (2) and (1) return the same small n (~64) → `limit` is being ignored "
        "regardless.\nIf (3) scales up but (1) doesn't → limit value is capped. If (5)/(6) "
        "return the full set → Vast moved to a body/endpoint format. If only (7) returns the "
        "full set → keyless requests are now capped (register a free key)."
    )


if __name__ == "__main__":
    asyncio.run(main())
