import { type ChildProcess, spawn } from "node:child_process";
import { get } from "node:http";

import { test as base } from "@playwright/test";

import { APP_PORT, BACKEND_PORT, setServers } from "./support";

type Servers = { appURL: string; backendURL: string };

/** Whether `url` answers 200 now. */
function answers(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    get(url, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}

/** Polls `url` until it answers 200, or fails with what the process printed. */
async function ready(url: string, child: ChildProcess, output: () => string, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`${url}: exited (${child.exitCode})\n${output()}`);
    if (await answers(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${url}: not ready after ${timeoutMs} ms\n${output()}`);
}

function start(script: string, env: Record<string, string>) {
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const keep = (chunk: Buffer) => {
    log = (log + chunk.toString()).slice(-4000);
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  return { child, output: () => log };
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

/**
 * Each worker runs its own fake backend and its own console (the production build) against it, on
 * the base ports plus the worker's slot, so workers run side by side without sharing sessions,
 * counters or resets. Import `test` from here, not from @playwright/test.
 */
export const test = base.extend<object, { servers: Servers }>({
  servers: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the fixtures argument
    async ({}, use, workerInfo) => {
      const slot = workerInfo.parallelIndex;
      const backendURL = `http://127.0.0.1:${BACKEND_PORT + slot}`;
      const appURL = `http://127.0.0.1:${APP_PORT + slot}`;

      const backend = start("tests/e2e/fixtures/fake-backend.mjs", {
        FAKE_BACKEND_PORT: String(BACKEND_PORT + slot),
      });
      const app = start(".output/server/index.mjs", {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(APP_PORT + slot),
        SERVER_URL: backendURL,
        PUBLIC_API_URL: backendURL,
        SESSION_SECRET: "e2e-only-session-secret-not-used-anywhere-else", // test-only value
      });
      try {
        await ready(`${backendURL}/healthz`, backend.child, backend.output, 15_000);
        await ready(`${appURL}/healthz`, app.child, app.output, 30_000);
        setServers(appURL, backendURL);
        await use({ appURL, backendURL });
      } finally {
        await Promise.all([stop(app.child), stop(backend.child)]);
      }
    },
    { scope: "worker", auto: true, timeout: 60_000 },
  ],
  baseURL: async ({ servers }, use) => {
    await use(servers.appURL);
  },
});

export { expect } from "@playwright/test";
