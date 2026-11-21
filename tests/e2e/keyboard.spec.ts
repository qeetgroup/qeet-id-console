// The console by keyboard alone, against the production build: sign-in, the skip link, the
// command palette, the account menu, a drawer and a table's rows. WCAG 2.1.1 (keyboard), 2.1.2 (no
// trap), 2.4.1 (bypass blocks), 2.4.3 (focus order) and 2.4.7 (focus visible).
import { expect, type Page, test } from "@playwright/test";

import { ADMIN, APP_URL, BACKEND_URL, hydrated, PASSWORD, signIn } from "./support";

test.beforeEach(async ({ request }) => {
  await request.post(`${BACKEND_URL}/__test__/reset`);
});

/** What has focus, as its accessible name or text; and whether it shows that it has it. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const style = el ? getComputedStyle(el) : null;
    return {
      name: el?.getAttribute("aria-label") || el?.textContent?.trim() || "",
      tag: el?.tagName.toLowerCase() ?? "",
      visible: !!style && (style.outlineStyle !== "none" || style.boxShadow !== "none"),
    };
  });

test("signs in by keyboard, the email step before the password", async ({ page }) => {
  await page.goto("/sign-in");
  await hydrated(page);
  const order: string[] = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    order.push((await focused(page)).tag);
  }
  // The skip link and the header's links, then the email field, then Continue.
  expect(order.indexOf("input")).toBeGreaterThan(-1);
  expect(order.indexOf("input")).toBeLessThan(order.lastIndexOf("button"));
  await page.getByLabel("Work email").focus();
  await page.keyboard.type(ADMIN.email);
  await page.keyboard.press("Enter");
  const password = page.getByRole("textbox", { name: "Password", exact: true });
  await expect(password).toBeFocused();
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${APP_URL}/`);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN.email);
    await hydrated(page);
  });

  test("starts with a skip link that moves focus to the page's content", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = await focused(page);
    expect(skip.name).toBe("Skip to main content");
    expect(skip.visible).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("opens the command palette from anywhere and gives focus back", async ({ page }) => {
    const search = page.getByRole("button", { name: /Search or jump to/ });
    await search.focus();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("combobox", { name: "Search or jump to" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(search).toBeFocused();
  });

  test("runs the account menu with Enter, arrows and Escape", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /account menu/i });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const items = page.getByRole("menuitem");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect((await focused(page)).visible).toBe(true);
  });

  test("keeps focus in a drawer until it closes, then returns it", async ({ page }) => {
    await page.goto("/invitations");
    await hydrated(page);
    const invite = page.getByRole("button", { name: "Invite people" });
    await invite.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Add people" });
    await expect(dialog.locator(":focus")).toHaveCount(1);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      // The page behind is inert while the drawer is open: focus never lands in it, only on the
      // drawer or the focus guards at its edges, which hand it straight back.
      const behind = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el.hasAttribute("data-base-ui-focus-guard")) return undefined;
        return el.closest("[data-base-ui-inert]")?.outerHTML.slice(0, 120);
      });
      expect(behind).toBeUndefined();
    }
    // Its Close button shows no tooltip, so nothing takes the first Escape: it closes the drawer
    // and focus goes back to what opened it. From a field, Escape closes it too.
    await dialog.getByRole("button", { name: "Close" }).focus();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(invite).toBeFocused();
    await page.keyboard.press("Enter");
    await dialog.getByRole("textbox").first().focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(invite).toBeFocused();
  });

  test("opens a table's row with Enter", async ({ page }) => {
    await page.goto("/users");
    await hydrated(page);
    const row = page.getByRole("link", { name: /Priya Patel/ }).first();
    await row.focus();
    expect((await focused(page)).visible).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}$/);
  });
});
