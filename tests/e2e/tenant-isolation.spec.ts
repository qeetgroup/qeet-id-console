// Two people in two tenants, signed in at once in separate browsers and rendered concurrently by
// one server process: neither may ever see the other's identity.
import { expect, test } from "@playwright/test";

import {
  BACKEND_URL,
  MULTI,
  OPERATOR,
  ORG_ONE,
  ORG_TWO,
  recordBackendPaths,
  SECOND,
  signIn,
  signInTo,
} from "./support";

test.beforeEach(async ({ request }) => {
  await request.post(`${BACKEND_URL}/__test__/reset`);
});

test("keeps two people's sessions apart under concurrent requests", async ({ browser }) => {
  const people = [OPERATOR, SECOND];
  const contexts = await Promise.all(people.map(() => browser.newContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  await Promise.all(pages.map((page, i) => signIn(page, people[i]?.email)));

  for (let round = 0; round < 3; round++) {
    await Promise.all(pages.map((page) => page.goto("/account/profile")));
    await Promise.all(
      pages.map((page, i) => expect(page.locator("#email")).toHaveValue(people[i]?.email ?? "")),
    );
  }

  await Promise.all(contexts.map((context) => context.close()));
});

test("switching organization moves every tab and stops reading the old one's data", async ({
  context,
  page,
}) => {
  await signInTo(page, MULTI.email, ORG_ONE.name);
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  // The top bar names the organization; switching is in the account menu, through the picker.
  await expect(otherTab.getByRole("banner").getByText(ORG_ONE.name, { exact: true })).toBeVisible();

  await page.getByLabel("Account menu").click();
  await page.getByRole("menuitem", { name: /Switch organisation/ }).click();
  await expect(page).toHaveURL(/\/select-organization$/);
  await page.getByText(ORG_TWO.name, { exact: true }).click();

  // The switch reloads both tabs into the new organization.
  for (const tab of [page, otherTab]) {
    await expect(tab.getByRole("banner").getByText(ORG_TWO.name, { exact: true })).toBeVisible();
  }

  // Fresh loads from either tab now read only the new organization.
  const paths = [page, otherTab].map(recordBackendPaths);
  for (const tab of [page, otherTab]) {
    await tab.goto("/");
    await expect(tab.getByLabel("Account menu")).toBeVisible();
    await tab.waitForLoadState("networkidle");
  }
  const requested = paths.flat();
  expect(requested.some((path) => path.includes(ORG_TWO.id))).toBe(true);
  expect(requested.filter((path) => path.includes(ORG_ONE.id))).toEqual([]);
});
