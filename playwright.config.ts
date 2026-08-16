import { defineConfig, devices } from "@playwright/test";

const appUrl = "http://127.0.0.1:43173";
const backendUrl = "http://127.0.0.1:43101";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: appUrl,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/fixtures/fake-backend.mjs",
      url: `${backendUrl}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run dev -- --host 127.0.0.1 --port 43173",
      url: `${appUrl}/sign-in`,
      env: {
        ...process.env,
        SERVER_URL: backendUrl,
        VITE_API_URL: backendUrl,
        SESSION_SECRET: "phase-one-playwright-session-secret-32-chars",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
