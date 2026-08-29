import { expect, test, type Locator, type Page } from "@playwright/test";

const backendUrl = "http://127.0.0.1:43101";
const appUrl = "http://127.0.0.1:43173";

// The sign-in inputs are controlled by React. Typing into the server-rendered markup before
// hydration completes is silently reverted the moment React takes ownership, which submits the
// form with an empty field and leaves us on /sign-in. Under a cold Vite dev compile that window is
// wide enough to lose, so re-fill until the value survives rather than assuming one fill sticks.
async function fillOnceHydrated(field: Locator, value: string) {
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value, { timeout: 1_000 });
  }).toPass({ timeout: 90_000 });
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await fillOnceHydrated(page.getByLabel("Email"), "operator@example.com");
  await fillOnceHydrated(page.locator("#password"), "Password123!");
  const submit = page.getByRole("button", { name: "Login", exact: true });
  await expect(page.locator("form").first()).toHaveAttribute("method", "post");
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  // First authenticated navigation cold-compiles the dashboard route tree under Vite dev. The
  // router cannot complete the redirect until that lazy chunk is built, so this assertion — not
  // the click — is what absorbs the compile. Measured past 30s on CI; 90s leaves real headroom.
  await expect(page).toHaveURL(/\/$/, { timeout: 90_000 });
  await expect(page.getByLabel("Account menu")).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(async ({ request }) => {
  await request.post(`${backendUrl}/__test__/reset`);
});

test("redirects an anonymous protected request without creating a session", async ({
  context,
  page,
}) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name.includes("qeet_console"))).toBe(
    false,
  );
});

test("rejects cross-origin BFF mutations", async ({ request }) => {
  const response = await request.post(
    `${appUrl}/api/qeetai-stream?path=/v1/qeetai/conversations/11111111-1111-4111-8111-111111111111/messages`,
    {
      headers: {
        Origin: backendUrl,
        "Sec-Fetch-Site": "cross-site",
      },
      data: { messages: [] },
    },
  );
  expect(response.status()).toBe(403);
});

test("stores the session only in an HttpOnly cookie and survives a hard refresh", async ({
  context,
  page,
}) => {
  await signIn(page);

  const storage = await page.evaluate(() => ({
    access: localStorage.getItem("qeetid.access_token"),
    refresh: localStorage.getItem("qeetid.refresh_token"),
    tenant: localStorage.getItem("qeetid.tenant_id"),
    user: localStorage.getItem("qeetid.user_id"),
    visibleCookies: document.cookie,
  }));
  expect(storage).toMatchObject({ access: null, refresh: null, tenant: null, user: null });
  expect(storage.visibleCookies).not.toContain("qeet_console");

  const sessionCookies = (await context.cookies()).filter((cookie) =>
    cookie.name.includes("qeet_console"),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);
  expect(sessionCookies.every((cookie) => cookie.httpOnly)).toBe(true);
  expect(sessionCookies.every((cookie) => cookie.sameSite === "Lax")).toBe(true);

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Account menu")).toBeVisible();
});

test("propagates logout to another tab and clears the cookie", async ({ context, page }) => {
  await signIn(page);
  const secondPage = await context.newPage();
  await secondPage.goto("/");
  await expect(secondPage.getByLabel("Account menu")).toBeVisible();

  await page.getByLabel("Account menu").click();
  await page.getByText("Sign out", { exact: true }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(secondPage).toHaveURL(/\/sign-in$/);
  expect((await context.cookies()).some((cookie) => cookie.name.includes("qeet_console"))).toBe(
    false,
  );
});

test("single-flights simultaneous expired-session refreshes across tabs", async ({
  context,
  page,
  request,
}) => {
  await signIn(page);
  const secondPage = await context.newPage();
  await secondPage.goto("/");
  await expect(secondPage.getByLabel("Account menu")).toBeVisible();

  await request.post(`${backendUrl}/__test__/expire`);
  await Promise.all([page.goto("/account/profile"), secondPage.goto("/account/profile")]);

  await expect(page.locator("#email")).toHaveValue("operator@example.com", { timeout: 30_000 });
  await expect(secondPage.locator("#email")).toHaveValue("operator@example.com", {
    timeout: 30_000,
  });
  const stats = await request.get(`${backendUrl}/__test__/stats`);
  expect(await stats.json()).toMatchObject({ refresh_calls: 1 });
});
