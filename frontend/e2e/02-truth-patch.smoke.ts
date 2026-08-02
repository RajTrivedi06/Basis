import { expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import {
  PROVIDER_STALE_AFTER_DAYS,
  numberWord,
  partitionProviders,
} from "../lib/providerStatus";
import type { ProviderSummary } from "../lib/types";
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

  test("providers page does not present retired providers as active", async ({
    page,
    request,
  }) => {
    // Retired providers keep their rows (their offers are real corpus
    // history); what must not happen is showing them as still collecting.
    // Expectations come from the API via the same staleness rule the page
    // uses, so no provider is named here either.
    const apiResponse = await request.get(`${API_URL}/api/providers`);
    expect(apiResponse.status(), "GET /api/providers").toBe(200);
    const { items } = (await apiResponse.json()) as { items: ProviderSummary[] };
    const { active, retired } = partitionProviders(items);

    console.log(
      `API · active: ${active.map((p) => p.provider).join(", ") || "none"} | ` +
        `retired (no collection in ${PROVIDER_STALE_AFTER_DAYS}d): ` +
        `${retired.map((p) => p.provider).join(", ") || "none"}`
    );

    await gotoRendered(page, "/providers");
    const table = page.locator("table").first();
    await expect(table).toBeVisible();
    console.log(`PROVIDERS TABLE:\n${normalize(await table.innerText())}`);

    const rows = await table.locator("tbody tr").all();
    const rendered = await Promise.all(
      rows.map(async (row) => {
        const cells = row.locator("td");
        return {
          provider: normalize(await cells.first().innerText()).replace(/\s*Retired$/i, ""),
          tagged: (await row.locator(".tag-quiet").count()) > 0,
        };
      })
    );

    for (const provider of retired) {
      const row = rendered.find((entry) => entry.provider === provider.provider);
      expect(row, `no row rendered for ${provider.provider}`).toBeDefined();
      expect(
        row!.tagged,
        `${provider.provider} is stale per the API but renders no Retired tag`
      ).toBe(true);
    }

    for (const provider of active) {
      const row = rendered.find((entry) => entry.provider === provider.provider);
      expect(row, `no row rendered for ${provider.provider}`).toBeDefined();
      expect(
        row!.tagged,
        `${provider.provider} collected recently but renders a Retired tag`
      ).toBe(false);
    }

    // Retired rows sort below active rows.
    const firstRetiredIndex = rendered.findIndex((entry) => entry.tagged);
    const lastActiveIndex = rendered.map((entry) => entry.tagged).lastIndexOf(false);
    if (firstRetiredIndex !== -1) {
      expect(firstRetiredIndex, "retired rows must sort below active rows").toBeGreaterThan(
        lastActiveIndex
      );
    }

    // Headline count is derived from the active subset, not the row count.
    const headline = normalize(await page.locator("h1").first().innerText());
    console.log(`PROVIDERS HEADLINE: ${headline}`);
    expect(
      headline.toLowerCase(),
      `headline should count the ${active.length} active provider(s), not all ${rendered.length} rows`
    ).toContain(numberWord(active.length).toLowerCase());
  });
});
