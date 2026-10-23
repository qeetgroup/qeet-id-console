import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

import { APP_URL, BACKEND_URL } from "./tests/e2e/support";

// Browser tests for the session boundary, against the production build and a fake backend. The
// tests wait for an explicit hydration marker, so there are no retries: a flake is a bug.
if (!existsSync(".output/server/index.mjs")) {
  throw new Error("No production build in .output — run `bun run test:e2e`, which builds first.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_URL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/fixtures/fake-backend.mjs",
      url: `${BACKEND_URL}/healthz`,
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: "node .output/server/index.mjs",
      url: `${APP_URL}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: new URL(APP_URL).port,
        SERVER_URL: BACKEND_URL,
        PUBLIC_API_URL: BACKEND_URL,
        SESSION_SECRET: "e2e-only-session-secret-not-used-anywhere-else", // test-only value
      },
    },
  ],
});
