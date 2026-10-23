// Two people in two tenants, signed in at once in separate browsers and rendered concurrently by
// one server process: neither may ever see the other's identity.
import { expect, test } from "@playwright/test";

import { BACKEND_URL, OPERATOR, SECOND, signIn } from "./support";

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
