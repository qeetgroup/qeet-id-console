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
  await expect(otherTab.getByRole("button", { name: new RegExp(ORG_ONE.name) })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(ORG_ONE.name) }).click();
  await page.getByRole("menuitem", { name: new RegExp(ORG_TWO.name) }).click();

  // The switch reloads both tabs into the new organization.
  for (const tab of [page, otherTab]) {
    await expect(tab.getByRole("button", { name: new RegExp(ORG_TWO.name) })).toBeVisible();
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
