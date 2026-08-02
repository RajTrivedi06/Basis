import { expect, test } from "@playwright/test";
import { ROUTES, attachCollectors, formatNetworkLog, gotoRendered } from "./helpers";

/**
 * Checks 6 and 7. One walk of every route with request/console collectors
 * attached. The full log is printed before any assertion so the proof exists
 * even when an assertion fails.
 */
test("checks 6 & 7 · API wiring and console cleanliness", async ({ page }) => {
  test.setTimeout(180_000);

  const { network, consoleEntries, pageErrors } = attachCollectors(page);

  for (const route of ROUTES) {
    await gotoRendered(page, route);
  }

  const apiRequests = network.filter((entry) => entry.host === "api.gpu-basis.xyz");
  const localhostRequests = network.filter((entry) => /^localhost:|^127\.0\.0\.1:/.test(entry.host));
  const localhost8000 = network.filter((entry) => entry.host.includes("localhost:8000"));

  console.log(`\n=== NETWORK LOG · api.gpu-basis.xyz (${apiRequests.length}) ===`);
  console.log(formatNetworkLog(apiRequests));

  const hosts = [...new Set(network.map((entry) => entry.host))].sort();
  console.log(`\n=== HOSTS CONTACTED (${hosts.length}) ===`);
  for (const host of hosts) {
    console.log(`  ${host} · ${network.filter((e) => e.host === host).length} request(s)`);
  }

  const warnings = consoleEntries.filter((entry) => entry.type === "warning");
  const errors = consoleEntries.filter((entry) => entry.type === "error");

  console.log(`\n=== CONSOLE WARNINGS (${warnings.length}, reported not fatal) ===`);
  for (const warning of warnings) console.log(`  ${warning.text} @ ${warning.location}`);
  console.log(`\n=== CONSOLE ERRORS (${errors.length}) ===`);
  for (const error of errors) console.log(`  ${error.text} @ ${error.location}`);
  console.log(`\n=== UNCAUGHT PAGE ERRORS (${pageErrors.length}) ===`);
  for (const error of pageErrors) console.log(`  ${error}`);

  // Check 6
  const api2xx = apiRequests.filter(
    (entry) => entry.status !== null && entry.status >= 200 && entry.status < 300
  );
  expect(api2xx.length, "2xx responses from api.gpu-basis.xyz").toBeGreaterThanOrEqual(1);
  expect(localhost8000, "requests to localhost:8000").toHaveLength(0);
  expect(localhostRequests, "requests to any localhost port").toHaveLength(0);

  // Check 7
  expect(errors.map((entry) => entry.text), "console errors").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
});
