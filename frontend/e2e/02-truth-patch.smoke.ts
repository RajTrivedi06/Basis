import { expect, test } from "@playwright/test";
import {
  TRUTH_PATCH_ROUTES,
  bodyText,
  gotoRendered,
  normalize,
  stripProviderCountData,
} from "./helpers";

/**
 * Checks 2 and 3. Every assertion reads the post-hydration DOM: the landing
 * hero is client-rendered, so the server HTML alone would prove nothing.
 */

test.describe("check 2 · truth-patch positive", () => {
  test("landing hero carries both anchored structural claims", async ({ page }) => {
    await gotoRendered(page, "/");

    // The hero is client-rendered; wait for the eyebrow before reading copy.
    await expect(page.getByText(/Market-priced segments/i).first()).toBeVisible();

    const text = await bodyText(page);
    expect(text, "ML anchor").toContain("45-feature");
    expect(text, "host-identity anchor").toMatch(/ICC 0\.55/);
  });

  test("landing hero states the live 20-61% range", async ({ page }) => {
    await gotoRendered(page, "/");
    await expect(page.getByText(/Market-priced segments/i).first()).toBeVisible();

    // normalize() folds en dash / em dash / unicode minus to "-".
    const text = await bodyText(page);
    expect(text, "live range with dash variants folded").toMatch(/20-61\s*%/);
  });

  test("Ask Basis is labelled Experimental", async ({ page }) => {
    await gotoRendered(page, "/");

    // exact: true — once the drawer opens, the backdrop's "Close Ask Basis"
    // label also substring-matches "Ask Basis".
    const launcher = page.getByRole("button", { name: "ASK BASIS", exact: true });
    await expect(launcher).toBeVisible();

    // Task 5.4 allowed either placement; shipped placement is a tag on the
    // drawer header, so the label is asserted after opening the drawer.
    await launcher.click();
    const drawer = page.getByRole("dialog", { name: "Ask Basis" });
    await expect(drawer).toBeVisible();

    const head = page.locator(".ask-drawer__head");
    await expect(head).toContainText(/Experimental/i);
    console.log(`ASK LABEL · launcher: ${normalize(await launcher.innerText())}`);
    console.log(`ASK LABEL · drawer head: ${normalize(await head.innerText())}`);
  });
});

test.describe("check 3 · truth-patch negative", () => {
  const DEAD_FIGURES: { label: string; pattern: RegExp }[] = [
    { label: "~59%", pattern: /~\s*59(\.\d)?\s*%/ },
    { label: "~89%", pattern: /~\s*89(\.\d)?\s*%/ },
    { label: "59→89", pattern: /59\s*(?:→|->|-)\s*89/ },
    { label: "4 providers", pattern: /\b4 providers\b/i },
  ];

  for (const route of TRUTH_PATCH_ROUTES) {
    test(`${route} is free of the dead headline figures`, async ({ page }) => {
      await gotoRendered(page, route);
      const { text, stripped } = stripProviderCountData(await bodyText(page));
      if (stripped > 0) {
        console.log(
          `${route}: ignored ${stripped} live "<n> offers · <m> providers" data row(s)`
        );
      }

      for (const { label, pattern } of DEAD_FIGURES) {
        expect(text, `dead figure "${label}" still rendered on ${route}`).not.toMatch(
          pattern
        );
      }
    });
  }

  test("providers page does not list TensorDock as active", async ({ page }) => {
    await gotoRendered(page, "/providers");

    // Historical prose may name TensorDock; the live provider table must not.
    const table = page.locator("table");
    await expect(table.first()).toBeVisible();
    const tableText = normalize(await table.first().innerText());
    console.log(`PROVIDERS TABLE:\n${tableText}`);

    expect(
      tableText,
      "TensorDock (retired 2026-06-12) appears as a row in the live providers " +
        "table with no retired marker, while the page headline reads " +
        '"Five providers, five postures"'
    ).not.toMatch(/tensordock/i);
  });
});
