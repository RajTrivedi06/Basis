import type { Page } from "@playwright/test";

export const ROUTES = [
  "/",
  "/basis",
  "/dispersion",
  "/explainability",
  "/methodology",
  "/providers",
] as const;

/** Pages that carry truth-patch copy and must be free of the dead figures. */
export const TRUTH_PATCH_ROUTES = ["/", "/methodology", "/basis"] as const;

export const ERROR_BOUNDARY_PATTERNS: RegExp[] = [
  /Application error: a client-side exception/i,
  /Unhandled Runtime Error/i,
  /This page could not be found/i,
  /Internal Server Error/i,
];

/**
 * Empty/failure states the app renders when data is missing. On production
 * with a populated corpus none of these should appear.
 */
export const UNEXPECTED_EMPTY_STATES: RegExp[] = [
  /Failed to load/i,
  /Results not yet published/i,
  /No provider data available/i,
  /No data in the selected range/i,
  /No decomposition available/i,
  /No dispersion data/i,
];

/**
 * Collapse dash and minus variants so assertions survive typographic
 * choices: en dash, em dash, unicode minus and fullwidth hyphen all become
 * an ASCII hyphen, and whitespace (including nbsp) is normalised.
 */
export function normalize(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212\uFF0D]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function bodyText(page: Page): Promise<string> {
  return normalize(await page.locator("body").innerText());
}

/**
 * Drop live "<n> offers · <m> providers" rows (SKU pickers, matrices) before
 * the stale-copy negative check. Those counts are per-SKU data pulled from
 * the API, not the retired "4 providers" corpus claim; leaving them in makes
 * the check fail whenever some SKU happens to have four providers.
 */
export function stripProviderCountData(text: string): {
  text: string;
  stripped: number;
} {
  const pattern = /\d[\d,]*\s*offers\s*·\s*\d+\s*providers/gi;
  const stripped = text.match(pattern)?.length ?? 0;
  return { text: text.replace(pattern, " "), stripped };
}

/** Wait for the client-rendered surfaces to settle before reading the DOM. */
export async function gotoRendered(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {
    // A long-lived connection (analytics beacon) can keep the network busy;
    // the DOM assertions below are the real gate.
  });
  return response;
}

export type NetworkEntry = {
  url: string;
  host: string;
  method: string;
  status: number | null;
  failure: string | null;
};

export type ConsoleEntry = { type: string; text: string; location: string };

/**
 * Attach request/response and console collectors to a page. Returns the
 * arrays, which fill as the page navigates.
 */
export function attachCollectors(page: Page) {
  const network: NetworkEntry[] = [];
  const consoleEntries: ConsoleEntry[] = [];
  const pageErrors: string[] = [];

  page.on("request", (request) => {
    let host = "";
    try {
      host = new URL(request.url()).host;
    } catch {
      host = "unparseable";
    }
    network.push({
      url: request.url(),
      host,
      method: request.method(),
      status: null,
      failure: null,
    });
  });

  page.on("response", async (response) => {
    const entry = network.find(
      (candidate) => candidate.url === response.url() && candidate.status === null
    );
    if (entry) entry.status = response.status();
  });

  page.on("requestfailed", (request) => {
    const entry = network.find(
      (candidate) => candidate.url === request.url() && candidate.status === null
    );
    if (entry) entry.failure = request.failure()?.errorText ?? "failed";
  });

  page.on("console", (message) => {
    consoleEntries.push({
      type: message.type(),
      text: message.text(),
      location: `${message.location().url}:${message.location().lineNumber}`,
    });
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { network, consoleEntries, pageErrors };
}

export function formatNetworkLog(entries: NetworkEntry[]): string {
  const lines = entries.map(
    (entry) =>
      `  ${String(entry.status ?? entry.failure ?? "pending").padEnd(8)} ${entry.method.padEnd(
        5
      )} ${entry.url}`
  );
  return lines.join("\n");
}
