import { type BrowserContext, type Cookie, expect, type Page } from "@playwright/test";

// Each worker runs its own fake backend and console (fixtures.ts), on these ports plus the worker's
// slot; overridable so two suites can run side by side on one machine.
export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 43173);
export const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 43101);
/** This worker's console and fake backend; set by the worker's `servers` fixture. */
export let APP_URL = `http://127.0.0.1:${APP_PORT}`;
export let BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

export function setServers(app: string, backend: string) {
  APP_URL = app;
  BACKEND_URL = backend;
}

export const OPERATOR = { email: "operator@example.com", name: "Ada Operator" };
export const SECOND = { email: "second@example.com", name: "Grace Second" };
export const MULTI = { email: "multi@example.com", name: "Max Multi" }; // member of both tenants
export const ADMIN = { email: "admin@example.com", name: "Alan Admin" }; // every capability
export const UNVERIFIED = { email: "unverified@example.com", name: "Uma Unverified" };
export const FRESH = { email: "fresh@example.com", name: "Fay Fresh" }; // no organisation yet
export const INVITED = { email: "invited@example.com", name: "Ivan Invited" }; // invited to Org Two
export const MEMBER = { id: "88888888-8888-4888-8888-888888888888", name: "Member of Org One" };
export const ORG_ONE = { id: "22222222-2222-4222-8222-222222222222", name: "Org One" };
export const ORG_TWO = { id: "33333333-3333-4333-8333-333333333333", name: "Org Two" };
export const PASSWORD = "Password123!";

/** Waits until React owns the server-rendered page (HydrationMarker in __root.tsx). */
export async function hydrated(page: Page) {
  await page.locator("html[data-hydrated]").waitFor();
}

async function submitSignIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await hydrated(page);
  // Email first: the work email, then the password step.
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function signIn(page: Page, email = OPERATOR.email) {
  await submitSignIn(page, email);
  await expect(page).toHaveURL(`${APP_URL}/`);
  await expect(page.getByLabel("Account menu")).toBeVisible();
}

// Sign-ins this worker kept, by email: reused while the backend's sessions are the ones they were
// made in (its generation, bumped by reset and expire) and well inside the access token's 10
// minutes, so a test never sends a refresh token another test already rotated.
const kept = new Map<string, { generation: number; at: number; cookies: Cookie[] }>();
const KEEP_FOR_MS = 4 * 60_000;

/**
 * Gives the page `email`'s session: signed in once per worker, then the same session cookie for
 * each later test. The page is left where it was (blank, for a new test) after a reuse, or on the
 * Dashboard after a sign-in, so the test goes to its page itself. For tests about pages; tests
 * about signing in use signIn.
 */
export async function signInOnce(page: Page, email: string) {
  const stats = await (await page.request.get(`${BACKEND_URL}/__test__/stats`)).json();
  const session = kept.get(email);
  if (session && session.generation === stats.generation && Date.now() - session.at < KEEP_FOR_MS) {
    await page.context().addCookies(session.cookies);
    return;
  }
  await signIn(page, email);
  kept.set(email, {
    generation: stats.generation,
    at: Date.now(),
    cookies: await sessionCookies(page.context()),
  });
}

/** Signs in a person whose email is unverified; the console holds them on /verify-email. */
export async function signInUnverified(page: Page, email = UNVERIFIED.email) {
  await submitSignIn(page, email);
  await expect(page).toHaveURL(`${APP_URL}/verify-email`);
}

/** Signs in `email` and waits on `path`: where an account without a console lands. */
export async function signInToEntry(page: Page, email: string, path: string) {
  await submitSignIn(page, email);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await hydrated(page);
}

/** Signs in a member of several organizations, who lands on the organization picker. */
export async function signInToPicker(page: Page, email = MULTI.email) {
  await submitSignIn(page, email);
  await expect(page).toHaveURL(`${APP_URL}/select-organization`);
  await hydrated(page);
}

/** Signs in a member of several organizations and enters `organization` from the picker. */
export async function signInTo(page: Page, email: string, organization: string) {
  await signInToPicker(page, email);
  await page.getByText(organization, { exact: true }).click(); // the row opens it in one click
  await expect(page).toHaveURL(`${APP_URL}/`);
  await expect(page.getByLabel("Account menu")).toBeVisible();
}

/** Collects the backend paths a page's server-function calls ask for. */
export function recordBackendPaths(page: Page): string[] {
  const paths: string[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/_serverFn/")) return;
    const path = request.postData()?.match(/\/v1\/[^"\\]+/)?.[0];
    if (path) paths.push(path);
  });
  return paths;
}

export async function sessionCookies(context: BrowserContext) {
  return (await context.cookies()).filter((cookie) => cookie.name.includes("qeet_console"));
}
