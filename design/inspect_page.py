"""Debug capture: screenshot + DOM dump + computed styles for a single route."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright


async def main(route: str, out: Path) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 1480, "height": 900}, device_scale_factor=2
        )
        page = await context.new_page()
        await page.goto(f"http://localhost:3000{route}", wait_until="networkidle")
        await page.wait_for_timeout(800)

        await page.screenshot(path=out / "full.png", full_page=True)

        # Header-only crop so we can see fonts / spacing on the shell.
        header = await page.query_selector("header")
        if header:
            await header.screenshot(path=out / "header.png")

        # Grab computed styles for a few key elements.
        probes = await page.evaluate(
            """
            () => {
                const pick = (sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return { sel, found: false };
                    const cs = getComputedStyle(el);
                    return {
                        sel,
                        found: true,
                        tag: el.tagName,
                        text: (el.textContent || '').slice(0, 60),
                        fontFamily: cs.fontFamily,
                        fontSize: cs.fontSize,
                        color: cs.color,
                        backgroundColor: cs.backgroundColor,
                    };
                };
                return {
                    root_vars: {
                        '--bg': getComputedStyle(document.documentElement).getPropertyValue('--bg'),
                        '--residual': getComputedStyle(document.documentElement).getPropertyValue('--residual'),
                        '--f-serif': getComputedStyle(document.documentElement).getPropertyValue('--f-serif'),
                        '--font-fraunces': getComputedStyle(document.documentElement).getPropertyValue('--font-fraunces'),
                        '--font-inter': getComputedStyle(document.documentElement).getPropertyValue('--font-inter'),
                    },
                    body: pick('body'),
                    wordmark: pick('header a span.font-serif'),
                    eyebrow: pick('header a span.mono'),
                    nav_active: pick('.nav-link.active'),
                    h1: pick('main h1'),
                    footer: pick('footer'),
                };
            }
            """
        )
        (out / "probes.json").write_text(json.dumps(probes, indent=2))
        await browser.close()


if __name__ == "__main__":
    route = sys.argv[1] if len(sys.argv) > 1 else "/"
    out = Path(__file__).parent / "debug"
    out.mkdir(exist_ok=True)
    asyncio.run(main(route, out))
    print(f"wrote to {out}")
