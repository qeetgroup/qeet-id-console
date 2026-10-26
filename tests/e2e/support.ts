import { type BrowserContext, expect, type Page } from "@playwright/test";

// Overridable so two suites can run side by side on one machine.
export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 43173);
export const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 43101);
export const APP_URL = `http://127.0.0.1:${APP_PORT}`;
export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

export const OPERATOR = { email: "operator@example.com", name: "Ada Operator" };
export const SECOND = { email: "second@example.com", name: "Grace Second" };
export const MULTI = { email: "multi@example.com", name: "Max Multi" }; // member of both tenants
export const ADMIN = { email: "admin@example.com", name: "Alan Admin" }; // every capability
export const UNVERIFIED = { email: "unverified@example.com", name: "Uma Unverified" };
export const MEMBER = { id: "88888888-8888-4888-8888-888888888888", name: "Member of Org One" };
export const ORG_ONE = { id: "22222222-2222-4222-8222-222222222222", name: "Org One" };
export const ORG_TWO = { id: "33333333-3333-4333-8333-333333333333", name: "Org Two" };
const PASSWORD = "Password123!";

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

/** Signs in a person whose email is unverified; the console holds them on /verify-email. */
export async function signInUnverified(page: Page, email = UNVERIFIED.email) {
  await submitSignIn(page, email);
  await expect(page).toHaveURL(`${APP_URL}/verify-email`);
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
  await page.getByText(organization, { exact: true }).click(); // the card's label selects it
  await page.getByRole("button", { name: "Continue to dashboard" }).click();
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
