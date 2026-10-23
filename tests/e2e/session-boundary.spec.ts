// The BFF session boundary in a real browser: the session lives only in an HttpOnly cookie that
// scripts can't read, survives a reload, refuses cross-site writes and ends everywhere at once.
import { expect, test } from "@playwright/test";

import { APP_URL, BACKEND_URL, OPERATOR, hydrated, sessionCookies, signIn } from "./support";

test.beforeEach(async ({ request }) => {
  await request.post(`${BACKEND_URL}/__test__/reset`);
});

test("redirects an anonymous visitor to sign-in without creating a session", async ({
  context,
  page,
}) => {
  await page.goto("/users");

  await expect(page).toHaveURL(`${APP_URL}/sign-in`);
  expect(await sessionCookies(context)).toEqual([]);
});

test("keeps the session in an HttpOnly cookie only, and survives a hard refresh", async ({
  context,
  page,
}) => {
  await signIn(page);

  const [cookie, ...rest] = await sessionCookies(context);
  expect(rest).toEqual([]);
  expect(cookie).toMatchObject({
    name: "__Host-qeet_console",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });

  // Nothing token-shaped reaches script-readable storage or the rendered HTML.
  const exposed = await page.evaluate(() => ({
    documentCookie: document.cookie,
    storage: JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  }));
  expect(exposed.documentCookie).toBe("");
  const html = await (await page.request.get("/")).text();
  for (const text of [exposed.storage, html]) {
    expect(text).not.toMatch(/refresh_[0-9a-f-]{36}/);
    expect(text).not.toMatch(/eyJhbGciOiJub25lIn0/); // the fake backend's access-token header
  }

  await page.reload();
  await hydrated(page);
  await expect(page).toHaveURL(`${APP_URL}/`);
  await expect(page.getByLabel("Account menu")).toBeVisible();
});

test("refuses a cross-site write to the BFF", async ({ request }) => {
  const response = await request.post(
    `${APP_URL}/api/qeetai-stream?path=/v1/qeetai/conversations/11111111-1111-4111-8111-111111111111/messages`,
    {
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
      data: { messages: [] },
    },
  );

  expect(response.status()).toBe(403);
});

test("signs out every tab and clears the cookie", async ({ context, page, request }) => {
  await signIn(page);
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await expect(otherTab.getByLabel("Account menu")).toBeVisible();

  await page.getByLabel("Account menu").click();
  await page.getByText("Sign out", { exact: true }).click();

  await expect(page).toHaveURL(`${APP_URL}/sign-in`);
  await expect(otherTab).toHaveURL(`${APP_URL}/sign-in`);
  expect(await sessionCookies(context)).toEqual([]);
  const stats = await (await request.get(`${BACKEND_URL}/__test__/stats`)).json();
  expect(stats.logout_calls).toBe(1);
});

test("refreshes an expired session once for two tabs at the same moment", async ({
  context,
  page,
  request,
}) => {
  await signIn(page);
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await expect(otherTab.getByLabel("Account menu")).toBeVisible();

  await request.post(`${BACKEND_URL}/__test__/expire`);
  await Promise.all([page.goto("/account/profile"), otherTab.goto("/account/profile")]);

  for (const tab of [page, otherTab]) {
    await expect(tab.locator("#email")).toHaveValue(OPERATOR.email);
  }
  const stats = await (await request.get(`${BACKEND_URL}/__test__/stats`)).json();
  expect(stats.refresh_calls).toBe(1);
});
