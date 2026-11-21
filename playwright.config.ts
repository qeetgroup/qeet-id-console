import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Browser tests for the session boundary and accessibility, against the production build and a
// fake backend. Each worker starts its own backend and console (tests/e2e/fixtures.ts), so tests run
// in parallel without sharing sessions. The tests wait for an explicit hydration marker, so there
// are no retries: a flake is a bug.
if (!existsSync(".output/server/index.mjs")) {
  throw new Error("No production build in .output — run `bun run test:e2e`, which builds first.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS ?? 4),
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
});
