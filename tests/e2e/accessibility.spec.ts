// WCAG 2.2 AA, checked by axe in a real browser against the production build: the signed-out
// screens, creating an organisation and the main console pages in both themes, and the overlays a page scan can't reach
// (command palette, a create sheet, a confirm dialog, a menu). Any violation fails.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  ADMIN,
  BACKEND_URL,
  hydrated,
  INVITED,
  MEMBER,
  ORG_TWO,
  signIn,
  signInToEntry,
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
  // The console's one overview, with the Organisation row (departments, where people work).
  {
    name: "dashboard",
    path: "/",
    ready: (page) => page.getByRole("heading", { name: "Where people work" }),
  },
  { name: "users", path: "/users", ready: (page) => page.getByText("Priya Patel") },
  {
    name: "users, suspended",
    path: "/users?status=suspended",
    ready: (page) => page.getByRole("table", { name: "Suspended people" }).getByText("Sam Lee"),
  },
  {
    name: "invitations",
    path: "/invitations",
    ready: (page) => page.getByText("kavya@org-one.example"),
  },
  { name: "deleted users", path: "/users/deleted", ready: (page) => page.getByText("Anil Bhatia") },
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
    name: "group page",
    path: "/groups/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    ready: (page) => page.getByRole("heading", { name: "Where it sits" }),
  },
  {
    name: "organisations",
    path: "/organizations",
    ready: (page) =>
      page.getByRole("table", { name: "Organisations" }).getByText("org-one.example"),
  },
  {
    name: "organisation page",
    path: "/organizations/22222222-2222-4222-8222-222222222222",
    ready: (page) => page.getByRole("link", { name: "Organisation created" }),
  },
  {
    name: "directory connections",
    path: "/directory/connections",
    ready: (page) =>
      page.getByRole("table", { name: "Connections" }).getByText("Corporate Active Directory"),
  },
  {
    name: "authorization roles",
    path: "/authorization/roles",
    ready: (page) => page.getByText("Reads members and resets their sign-in."),
  },
  {
    name: "organization settings",
    path: "/settings/organization/general",
    ready: (page) => page.getByRole("heading", { name: "About this organisation" }),
  },
  // The pages rebuilt in the agent wave (2026-10-28), scanned as the fake backend leaves them (an
  // empty read for anything it has no data for), so their empty states and chrome are covered;
  // ready once the page's own heading shows. Give one fake data to scan its full content too.
  ...(
    [
      ["activity", "/activity"],
      ["audit log", "/security/audit-logs"],
      ["anomalies", "/security/threats/anomalies"],
      ["ip rules", "/security/threats/ip-allowlist"],
      ["compliance", "/security/compliance/soc2"],
      ["analytics", "/analytics"],
      ["sso", "/auth/connections/saml"],
      ["password", "/auth/login-methods/password"],
      ["social sign-in", "/auth/social"],
      ["oauth grants", "/auth/api/consent-grants"],
      ["machine access", "/developer/machine-access"],
      ["webhooks", "/developer/webhooks"],
      ["authorization testing", "/authorization/testing"],
      ["abac", "/authorization/abac"],
      ["sync errors", "/directory/sync-errors"],
      ["mappings", "/directory/attribute-mappings"],
      ["billing", "/settings/billing"],
      ["branding", "/settings/branding"],
      ["domains", "/settings/organization/domains"],
      ["qeet ai settings", "/settings/qeet-ai"],
      ["import people", "/users/import"],
      ["person activity", `/users/${MEMBER.id}?tab=activity`],
    ] as const
  ).map(([name, path]) => ({
    name,
    path,
    ready: (page: Page) => page.locator("#main-content h1").first(),
  })),
  {
    name: "account profile",
    path: "/account/profile",
    ready: (page) => page.getByText("Member of", { exact: false }),
  },
  {
    name: "account security",
    path: "/account/security",
    ready: (page) => page.getByText("MacBook Pro (Touch ID)"),
  },
  {
    name: "account sessions",
    path: "/account/sessions",
    ready: (page) => page.getByText("Safari on iPhone"),
  },
  {
    name: "account data",
    path: "/account/data",
    ready: (page) => page.getByRole("heading", { name: "Delete your account" }),
  },
];

/**
 * Violations from inside the design system that the console can't fix: each excuses one rule on
 * one element, every other rule still applies to it, and its comment names the Qeetrix component
 * and the issue (raised with Qeetrix as a Jira ticket, whose key never appears here).
 */
const DESIGN_SYSTEM_ISSUES: { rule: string; element: string }[] = [
  // Table's row link (Qeetrix React 0.5): named by `rowLabel` ("Priya Patel") but wrapped around the
  // whole primary cell (the email under the name too), so its visible text isn't all in its name.
  // Label in name needs Qeetrix to name the link by what the row shows.
  { rule: "label-content-name-mismatch", element: ".qx-table-row-link" },
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
  // axe ships label-in-name (WCAG 2.5.3, level A) as experimental, off unless asked for. The tags
  // come after: options() replaces whatever was set before it.
  const { violations } = await new AxeBuilder({ page })
    .options({ rules: { "label-content-name-mismatch": { enabled: true } } })
    .withTags(WCAG_22_AA)
    .analyze();
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

    test("select-organization, invited", async ({ page }) => {
      await signInToEntry(page, INVITED.email, "/select-organization");
      await settle(page, page.getByRole("button", { name: "Join Org Two" }));
      await expectAccessible(page);
    });

    test("create-organization", async ({ page }) => {
      await signIn(page, ADMIN.email);
      await page.goto("/create-organization?from=organizations");
      await settle(page, page.getByRole("radio", { name: "Pro" }));
      await expectAccessible(page);
      await page.getByRole("button", { name: "Continue with Free" }).click();
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await settle(page, page.getByRole("textbox", { name: "Organisation name" }));
      await expectAccessible(page);
    });

    for (const target of CONSOLE_PAGES) {
      test(target.name, async ({ page }) => {
        await signIn(page, ADMIN.email);
        await page.goto(target.path);
        await settle(page, target.ready(page));
        await expect(page.locator("html")).toHaveAttribute("data-qx-color-scheme", theme);
        await expectAccessible(page);
      });
    }

    test("command palette", async ({ page }) => {
      await signIn(page, ADMIN.email);
      await settle(page, page.getByText("1,240"));
      await page.getByRole("button", { name: "Search or jump to…" }).click();
      await settle(page, page.getByRole("dialog"));
      await expectAccessible(page);
    });

    test("add people drawer", async ({ page }) => {
      await signIn(page, ADMIN.email);
      await page.goto("/invitations");
      await settle(page, page.getByRole("button", { name: "Invite people" }));
      await page.getByRole("button", { name: "Invite people" }).click();
      await settle(page, page.getByRole("dialog", { name: "Add people" }));
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

// WCAG 1.4.10 (reflow): at 320 CSS pixels nothing scrolls sideways, save content that needs two
// dimensions, which scrolls inside its own frame (a data table). A failure names what sticks out.
//
// These fail for the library alone: on Qeetrix React 0.5 a page header's actions don't wrap and a
// tab list doesn't scroll at 320px, so a person's page (three actions, five tabs) scrolls sideways.
// Tables scroll in their own frame since 0.2, which cleared every list page. Each is an expected
// failure, so the Qeetrix release that fixes one also fails here until it's taken off the list.
const LIBRARY_REFLOW = new Set(["user detail"]);

test.describe("phone width", () => {
  test.use({ viewport: { width: 320, height: 720 } });

  for (const target of CONSOLE_PAGES) {
    test(target.name, async ({ page }) => {
      test.fail(LIBRARY_REFLOW.has(target.name), "Qeetrix React 0.5 layout; see LIBRARY_REFLOW");
      await signIn(page, ADMIN.email);
      await page.goto(target.path);
      await settle(page, target.ready(page));
      const sticksOut = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth <= width + 1) return [];
        const past = (el: Element) => el.getBoundingClientRect().right > width + 1;
        return [...document.querySelectorAll("body *")]
          .filter((el) => past(el) && !(el.parentElement && past(el.parentElement)))
          .slice(0, 5)
          .map(
            (el) => `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`,
          );
      });
      expect(sticksOut).toEqual([]);
    });
  }
});

// Longer languages (P2-8): German and Hindi run about 40% longer than English. Each page's words
// grow by that much, where they are, so a long word stays one word as a German compound does, and
// then nothing scrolls sideways and no control, label or heading cuts its own words off (an
// ellipsis is a choice, so it passes). At phone width the pages the library can't yet narrow are
// expected failures, as above.
const LONGER = 0.4;
const LIBRARY_LONGER = new Set([...LIBRARY_REFLOW]);

async function lengthened(page: Page) {
  return page.evaluate(async (longer) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const words: Text[] = [];
    while (walker.nextNode()) words.push(walker.currentNode as Text);
    for (const node of words) {
      if (node.parentElement?.closest("script, style, code, pre, svg")) continue;
      node.textContent = (node.textContent ?? "").replace(
        /\p{L}+/gu,
        (word) => word + word.slice(0, Math.ceil(word.length * longer)),
      );
    }
    // Two frames, so what lays itself out by measuring (a table's scroll frame) sees the new words.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const width = document.documentElement.clientWidth;
    const named = (el: Element) =>
      `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`;
    const past = (el: Element) => el.getBoundingClientRect().right > width + 1;
    const sideways =
      document.documentElement.scrollWidth > width + 1
        ? [...document.querySelectorAll("body *")]
            .filter((el) => past(el) && !(el.parentElement && past(el.parentElement)))
            .slice(0, 5)
            .map(named)
        : [];
    const cut = [
      ...document.querySelectorAll(
        "button, a, label, th, h1, h2, h3, dt, [role=tab], [role=menuitem], [role=option]",
      ),
    ]
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      // Shown, on screen, and not visually hidden (as a skip link is until it has focus).
      .filter((el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
      .filter((el) => el.clientWidth > 1 && el.getBoundingClientRect().right > 0)
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .filter((el) => getComputedStyle(el).textOverflow !== "ellipsis")
      .slice(0, 5)
      .map((el) => `${named(el)}: ${(el.textContent ?? "").trim().slice(0, 40)}`);
    return { sideways, cut };
  }, LONGER);
}

for (const [label, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["phone", { width: 320, height: 720 }],
] as const) {
  test.describe(`longer languages, ${label}`, () => {
    test.use({ viewport });

    for (const target of CONSOLE_PAGES) {
      test(target.name, async ({ page }) => {
        test.fail(
          label === "phone" && LIBRARY_LONGER.has(target.name),
          "Qeetrix React 0.5 layout; see LIBRARY_LONGER",
        );
        await signIn(page, ADMIN.email);
        await page.goto(target.path);
        await settle(page, target.ready(page));
        expect(await lengthened(page)).toEqual({ sideways: [], cut: [] });
      });
    }
  });
}
