import { defineConfig } from "@playwright/test";

/**
 * Production smoke suite (Task 5.5).
 *
 * Runs against the deployed site — there is no `webServer` block, and the
 * suite must never be pointed at a local dev server (check 6 asserts that
 * nothing talks to localhost:8000). Override the target with SMOKE_BASE_URL
 * / SMOKE_API_URL when smoking a preview deployment.
 *
 * Artefacts are text-only per the workspace proof rules: no screenshots,
 * no video, no trace.
 */
export const BASE_URL = process.env.SMOKE_BASE_URL ?? "https://www.gpu-basis.xyz";
export const API_URL = process.env.SMOKE_API_URL ?? "https://api.gpu-basis.xyz";

export default defineConfig({
  testDir: "./e2e",
  // `.smoke.ts`, not `.spec.ts`: vitest's default glob claims **/*.spec.ts,
  // and the unit suite must not try to load Playwright.
  testMatch: "**/*.smoke.ts",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // One retry absorbs transient network blips against a live host; a real
  // regression fails both attempts.
  retries: 1,
  workers: 2,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["list", { printSteps: false }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 900 },
    screenshot: "off",
    video: "off",
    trace: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
