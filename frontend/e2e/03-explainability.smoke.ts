import { expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { bodyText, gotoRendered } from "./helpers";

/**
 * Check 4. The page must render the numbers the API actually serves, so the
 * expected strings are derived from the live artifact rather than hardcoded.
 * Formatting mirrors BoundBar: percentages to one decimal, gap in pp.
 */
test("check 4 · /explainability renders live artifact values", async ({
  page,
  request,
}) => {
  const response = await request.get(`${API_URL}/api/ml/explainability`);
  expect(response.status(), "GET /api/ml/explainability").toBe(200);

  const artifact = await response.json();
  const holdoutR2 = artifact.metrics.holdout.r2_oos as number;
  const anova = artifact.metrics.anova_explained_same_days as number;
  const gap = artifact.metrics.gap as number;

  const holdoutLabel = `${(holdoutR2 * 100).toFixed(1)}%`;
  const anovaLabel = `${(anova * 100).toFixed(1)}%`;
  // BoundBar renders a unicode minus; normalize() folds it to ASCII, which
  // is what toFixed produces here.
  const gapLabel = `${(gap * 100).toFixed(1)} pp`;

  console.log(
    `ARTIFACT · holdout R²=${holdoutLabel} anova=${anovaLabel} gap=${gapLabel} ` +
      `(trained ${artifact.metadata.trained_at})`
  );

  expect(gap, "gap should still be negative").toBeLessThan(0);

  await gotoRendered(page, "/explainability");
  const text = await bodyText(page);

  expect(text, "holdout R² from the artifact").toContain(holdoutLabel);
  expect(text, "in-sample ANOVA share from the artifact").toContain(anovaLabel);
  // normalize() folds the unicode minus the component renders.
  expect(text, "negative gap from the artifact").toContain(gapLabel);
});
