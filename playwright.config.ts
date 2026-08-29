import { defineConfig, devices } from "@playwright/test";

const appUrl = "http://127.0.0.1:43173";
const backendUrl = "http://127.0.0.1:43101";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  // The first authenticated navigation cold-compiles the whole dashboard route tree under Vite
  // dev — three.js, @xyflow/react and @qeetrix/ui all get pulled in. On a CI runner that has
  // measured past 30s, so the per-test budget has to sit well above signIn()'s own timeout.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  // Only the first signIn() pays the cold-compile cost; a retry runs against a warm module graph.
  // Playwright reports a passing retry as "flaky" rather than green, so this stays visible.
  retries: process.env.CI ? 2 : 0,
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
