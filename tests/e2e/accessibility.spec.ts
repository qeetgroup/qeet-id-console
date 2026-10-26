// WCAG 2.2 AA, checked by axe in a real browser against the production build: the signed-out
// screens and the main console pages in both themes, and the overlays a page scan can't reach
// (command palette, a create sheet, a confirm dialog, a menu). Any violation fails.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  ADMIN,
  BACKEND_URL,
  hydrated,
  MEMBER,
  ORG_TWO,
  signIn,
  signInToPicker,
  signInUnverified,
  UNVERIFIED,
} from "./support";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["light", "dark"] as const;
const THEME_STORAGE_KEY = "qeetid-admin-theme"; // as ThemeProvider in src/routes/__root.tsx

type Target = {
  name: string;
  path: string;
  ready: (page: Page) => Locator; // the page's real content, not its loading or empty state
};

const CONSOLE_PAGES: Target[] = [
  { name: "dashboard", path: "/", ready: (page) => page.getByText("1,240") },
  { name: "users", path: "/users", ready: (page) => page.getByText("Priya Patel") },
  {
    name: "user detail",
    path: `/users/${MEMBER.id}`,
    ready: (page) => page.getByRole("heading", { name: MEMBER.name }),
  },
  {
    name: "groups",
    path: "/groups",
    ready: (page) => page.getByText("Runs the shared infrastructure."),
  },
  {
    name: "authorization roles",
    path: "/authorization/roles",
    ready: (page) => page.getByText("Reads members and resets their sign-in."),
  },
  {
    name: "security overview",
    path: "/security",
    ready: (page) => page.getByRole("heading", { name: "Security operations" }),
  },
  {
    name: "developer overview",
    path: "/developer",
    ready: (page) => page.getByText("API key created"),
  },
  {
    name: "organization settings",
    path: "/settings/organization/general",
    ready: (page) => page.getByRole("textbox", { name: "Organization name" }),
  },
  {
    name: "account profile",
    path: "/account/profile",
    ready: (page) => page.getByRole("textbox", { name: "Display name" }),
  },
];

/**
 * Violations from inside `@qeetrix/ui` that the console can't fix: each excuses one rule on one
 * element, every other rule still applies to it, and each is raised with qeetrix.
 */
const DESIGN_SYSTEM_ISSUES = [
  {
    // QTRX-7: Button variant="destructive" sets --qx-color-text-danger on
    // --qx-color-feedback-error-subtle, 4.09:1 on a dark-theme dialog (AA needs 4.5:1). Remove
    // this entry once a fixed @qeetrix/ui is released.
    rule: "color-contrast",
    element: '.dark [role="alertdialog"] [data-slot="button"][data-variant="destructive"]',
  },
];

/** Waits for the content, every panel's data and finite animations, so axe sees the page still. */
async function settle(page: Page, content: Locator) {
  await hydrated(page);
  await expect(content.first()).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0);
  await expect(page.locator('[aria-busy="true"]:visible')).toHaveCount(0);
  // Mid-fade colours would fail contrast; looping ones (spinners, shimmer) never finish, and the
  // cap keeps one that restarts from holding the test.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running")
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]),
  );
}

/** Fails with each violated rule and, for every element that breaks it, its markup and why. */
async function expectAccessible(page: Page) {
  // axe skips text over a gradient as "can't tell", which would leave the shell and the sidebar
  // unchecked. Their gradients are faint tints over a solid token, so contrast is measured on that.
  await page.addStyleTag({
    content: `.console-shell, .console-sidebar [data-slot="sidebar-inner"] {
      background-image: none !important;
    }`,
  });
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  const found = [];
  for (const violation of violations) {
    const known = DESIGN_SYSTEM_ISSUES.filter((issue) => issue.rule === violation.id);
    const nodes = [];
    for (const node of violation.nodes) {
      const target = node.target.join(" ");
      const excused =
        known.length > 0 &&
        (await page.locator(target).evaluate(
          (element, selectors) => selectors.some((selector) => element.matches(selector)),
          known.map((issue) => issue.element),
        ));
      if (!excused) nodes.push({ target, html: node.html.slice(0, 200), why: node.failureSummary });
    }
    if (nodes.length > 0) found.push({ rule: violation.id, help: violation.help, elements: nodes });
  }
  expect(found).toEqual([]);
}

// Each test signs in, renders a full page and runs axe over all of it.
test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ request }) => {
  await request.post(`${BACKEND_URL}/__test__/reset`);
});

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ page }) => {
      // Before any script runs, as the theme toggle would have saved it.
      await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
        THEME_STORAGE_KEY,
        theme,
      ] as const);
    });

    test("sign-in", async ({ page }) => {
      await page.goto("/sign-in");
      await settle(page, page.getByRole("button", { name: "Continue", exact: true }));
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      await expect(page.locator("html")).toHaveAttribute("data-qx-color-scheme", theme);
      await expectAccessible(page);
    });

    test("sign-up", async ({ page }) => {
      await page.goto("/sign-up");
      await settle(page, page.getByRole("button", { name: "Create account with a passkey" }));
      await expectAccessible(page);
    });

    test("verify-email", async ({ page }) => {
      await signInUnverified(page);
      await settle(page, page.getByText(UNVERIFIED.email));
      await expectAccessible(page);
    });

    test("select-organization", async ({ page }) => {
      await signInToPicker(page);
      await settle(page, page.getByText(ORG_TWO.name, { exact: true }));
      await expectAccessible(page);
    });

    for (const target of CONSOLE_PAGES) {
      test(target.name, async ({ page }) => {
        await signIn(page, ADMIN.email);
        await page.goto(target.path);
        await settle(page, target.ready(page));
        await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
        await expectAccessible(page);
      });
    }

    test("command palette", async ({ page }) => {
      await signIn(page, ADMIN.email);
      await settle(page, page.getByText("1,240"));
      await page.getByRole("button", { name: "Search the control plane" }).click();
      await settle(page, page.getByRole("dialog"));
      await expectAccessible(page);
    });

    test("invite sheet", async ({ page }) => {
      await signIn(page, ADMIN.email);
      await page.goto("/invitations");
      await settle(page, page.getByRole("button", { name: "Send invite" }));
      await page.getByRole("button", { name: "Send invite" }).click();
      await settle(page, page.getByRole("dialog", { name: "Send invitation" }));
      await expectAccessible(page);
    });

    test("confirm dialog", async ({ page }) => {
      await signIn(page, ADMIN.email);
      await page.goto(`/users/${MEMBER.id}`);
      await settle(page, page.getByRole("heading", { name: MEMBER.name }));
      await page.getByRole("button", { name: "Delete user" }).click();
      await settle(page, page.getByRole("alertdialog"));
      await expectAccessible(page);
    });

    test("account menu", async ({ page }) => {
      await signIn(page, ADMIN.email);
      await settle(page, page.getByText("1,240"));
      await page.getByLabel("Account menu").click();
      await settle(page, page.getByRole("menu"));
      await expectAccessible(page);
    });
  });
}
