"""Capture full-page screenshots of every dashboard route.

Usage (from repo root):
    uv run python design/screenshot.py <output_subdir>

Writes PNG files to design/<output_subdir>/{findings,dispersion,basis,providers,methodology}.png
at 1480x900 viewport, full-page mode. Waits for network idle before each
capture so React Query has a chance to hydrate the data before we snap.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROUTES: list[tuple[str, str]] = [
    ("/", "findings"),
    ("/dispersion", "dispersion"),
    ("/basis", "basis"),
    ("/providers", "providers"),
    ("/methodology", "methodology"),
]

BASE_URL = "http://localhost:3000"
VIEWPORT = {"width": 1480, "height": 900}


async def main(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=2,  # Retina-quality PNGs
        )
        page = await context.new_page()
        for path, name in ROUTES:
            url = f"{BASE_URL}{path}"
            print(f"  {name:14s}  {url}")
            await page.goto(url, wait_until="networkidle", timeout=15000)
            # Small settle for any post-hydration animation.
            await page.wait_for_timeout(600)
            await page.screenshot(path=out_dir / f"{name}.png", full_page=True)
        await browser.close()


if __name__ == "__main__":
    subdir = sys.argv[1] if len(sys.argv) > 1 else "pre-port-baseline"
    target = Path(__file__).parent / subdir
    asyncio.run(main(target))
    print(f"wrote to {target}")
