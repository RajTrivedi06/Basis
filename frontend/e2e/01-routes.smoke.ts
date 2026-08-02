import { expect, test } from "@playwright/test";
import {
  ERROR_BOUNDARY_PATTERNS,
  ROUTES,
  UNEXPECTED_EMPTY_STATES,
  bodyText,
  gotoRendered,
} from "./helpers";

test.describe("check 1 · routes render", () => {
  for (const route of ROUTES) {
    test(`${route} returns 200 and renders content`, async ({ page }) => {
      const response = await gotoRendered(page, route);

      expect(response, `no response for ${route}`).not.toBeNull();
      expect(response!.status(), `HTTP status for ${route}`).toBe(200);

      const text = await bodyText(page);
      expect(text.length, `rendered text length for ${route}`).toBeGreaterThan(200);

      for (const pattern of ERROR_BOUNDARY_PATTERNS) {
        expect(text, `error boundary on ${route}`).not.toMatch(pattern);
      }
      for (const pattern of UNEXPECTED_EMPTY_STATES) {
        expect(text, `unexpected empty state on ${route}`).not.toMatch(pattern);
      }
    });
  }
});
