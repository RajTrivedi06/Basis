import { expect, test } from "@playwright/test";
import { gotoRendered, normalize } from "./helpers";

const QUESTION = "What share of H100 price variance is unexplained?";

/**
 * Check 5. Streaming answer against the live model, so this test is slow and
 * runs alone (one question per run keeps it inside the production rate limit).
 *
 * Per the Manager's flake guard: the market-priced-segment label is the tool's
 * primary and is asserted strictly. The pooled figure is desirable but is a
 * property of model verbosity, so its absence is reported, not failed.
 */
test.describe.configure({ mode: "serial" });

test("check 5 · Ask Basis answers with citations and labelled figures", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await gotoRendered(page, "/");
  await page.getByRole("button", { name: "ASK BASIS", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Ask Basis" })).toBeVisible();

  await page.getByPlaceholder(/What share of H100-SXM/).fill(QUESTION);
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  // The answer streams token by token; the Sources section only renders once
  // the final response lands, so it is the completion signal.
  const sources = page.locator(".ask-sources__toggle");
  await expect(sources).toBeVisible({ timeout: 150_000 });

  const alert = page.getByRole("alert");
  if (await alert.count()) {
    console.log(`ASK ALERT: ${normalize(await alert.first().innerText())}`);
  }

  const answer = normalize(await page.locator(".ask-answer__body").last().innerText());
  console.log(`ASK QUESTION: ${QUESTION}`);
  console.log(`ASK ANSWER: ${answer}`);

  const citationMarkers = page.locator("a.ask-cite");
  const citationCount = await citationMarkers.count();
  console.log(`ASK CITATION MARKERS: ${citationCount}`);
  console.log(`ASK SOURCES TOGGLE: ${normalize(await sources.innerText())}`);
  expect(citationCount, "inline citation markers").toBeGreaterThanOrEqual(1);

  // Strict: the primary figure must be labelled as the market-priced segment.
  const marketPricedLabel =
    /market[- ]priced|marketplaces? \+ spot|excluding (azure|the (list )?catalog)/i;
  expect(answer, "market-priced-segment label on the primary figure").toMatch(
    marketPricedLabel
  );

  // Soft: pooled figure is ideal but model verbosity varies. Report only.
  const pooledLabel = /pooled|all[- ]provider|administered|list catalog/i;
  if (!pooledLabel.test(answer)) {
    console.log(
      "REPORT (not a failure): pooled/administered figure absent from the answer prose: " +
        "primary market-priced figure was labelled, which the flake guard treats as a pass."
    );
  } else {
    console.log("ASK FRAMING: both market-priced and pooled figures present (ideal).");
  }
});
