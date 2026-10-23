import { type BrowserContext, expect, type Page } from "@playwright/test";

export const APP_URL = "http://127.0.0.1:43173";
export const BACKEND_URL = "http://127.0.0.1:43101";

export const OPERATOR = { email: "operator@example.com", name: "Ada Operator" };
export const SECOND = { email: "second@example.com", name: "Grace Second" };
const PASSWORD = "Password123!";

/** Waits until React owns the server-rendered page (HydrationMarker in __root.tsx). */
export async function hydrated(page: Page) {
  await page.locator("html[data-hydrated]").waitFor();
}

export async function signIn(page: Page, email = OPERATOR.email) {
  await page.goto("/sign-in");
  await hydrated(page);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${APP_URL}/`);
  await expect(page.getByLabel("Account menu")).toBeVisible();
}

export async function sessionCookies(context: BrowserContext) {
  return (await context.cookies()).filter((cookie) => cookie.name.includes("qeet_console"));
}
