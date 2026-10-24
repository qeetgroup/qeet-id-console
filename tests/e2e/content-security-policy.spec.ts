// The Content-Security-Policy in a real browser, against the production build: every page carries
// a fresh nonce on its policy and on each script, nothing the console needs is blocked, and the
// policy editor (Monaco) loads from the console itself rather than a CDN.
import { expect, type Page, test } from "@playwright/test";

import { APP_URL, BACKEND_URL, hydrated, signIn } from "./support";

test.beforeEach(async ({ request }) => {
  await request.post(`${BACKEND_URL}/__test__/reset`);
});

/** Records every policy violation the page reports, and every request leaving this origin. */
async function watch(page: Page) {
  const violations: string[] = [];
  const foreign: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["data:", "blob:"].includes(url.protocol) && url.origin !== APP_URL) {
      foreign.push(request.url());
    }
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(
        `Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI} at ${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
      );
    });
  });
  return { violations, foreign };
}

test("each page carries its own nonce, on its policy and on every script", async ({ request }) => {
  const nonces: string[] = [];
  for (let i = 0; i < 2; i++) {
    const response = await request.get("/sign-in");
    const policy = response.headers()["content-security-policy"] ?? "";
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1] ?? "";
    expect(nonce, policy).not.toBe("");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag);
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
    nonces.push(nonce);
  }
  expect(nonces[0]).not.toBe(nonces[1]);
});

test("the signed-out pages run under the policy without a violation", async ({ page }) => {
  const { violations, foreign } = await watch(page);
  for (const path of ["/sign-in", "/sign-up", "/forgot-password"]) {
    await page.goto(path);
    await hydrated(page);
  }
  expect(violations).toEqual([]);
  expect(foreign).toEqual([]);
});

test("the shell and the policy editor run under the policy, from this origin only", async ({
  page,
}) => {
  const { violations, foreign } = await watch(page);
  await signIn(page);
  await page.goto("/users");
  await hydrated(page);
  await page.goto("/authorization/simulator");
  await hydrated(page);
  // The engine with a JSON input; its radio is visually hidden behind its label.
  await page.locator('[data-slot="segmented-control-item"]', { hasText: "ABAC" }).click();
  // Monaco mounts its editor, with its workers, in place of the read-only fallback.
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 20_000 });
  expect(violations).toEqual([]);
  expect(foreign).toEqual([]);
});
