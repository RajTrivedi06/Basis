import { expect, test } from "@playwright/test";
import { ERROR_BOUNDARY_PATTERNS, ROUTES, bodyText, gotoRendered } from "./helpers";

/**
 * Check 8. Crashes fail; layout problems are collected for the Stage 6
 * blockers file rather than failing the smoke suite.
 */
const VIEWPORT = { width: 390, height: 844 };

const layoutFindings: string[] = [];

test.describe("check 8 · mobile viewport 390x844", () => {
  test.use({ viewport: VIEWPORT, hasTouch: true });

  for (const route of ROUTES) {
    test(`${route} renders on mobile`, async ({ page }) => {
      await gotoRendered(page, route);

      const text = await bodyText(page);
      expect(text.length, `rendered text length for ${route}`).toBeGreaterThan(200);
      for (const pattern of ERROR_BOUNDARY_PATTERNS) {
        expect(text, `error boundary on ${route} at mobile width`).not.toMatch(pattern);
      }

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      if (overflow.scrollWidth > overflow.clientWidth + 2) {
        layoutFindings.push(
          `${route}: horizontal overflow — scrollWidth ${overflow.scrollWidth}px vs viewport ${overflow.clientWidth}px`
        );
      }
    });
  }

  test.afterAll(() => {
    console.log(`\n=== STAGE 6 LAYOUT CANDIDATES (${layoutFindings.length}) ===`);
    if (layoutFindings.length === 0) {
      console.log("  none — no horizontal overflow at 390x844");
    }
    for (const finding of layoutFindings) console.log(`  ${finding}`);
  });
});
