// Creating an organisation is one page for every way in, and Cancel goes back to where it was
// opened from. An account without one goes straight there, unless an invitation is waiting.
import { expect, test } from "@playwright/test";

import {
  ADMIN,
  BACKEND_URL,
  FRESH,
  hydrated,
  INVITED,
  signIn,
  signInToEntry,
  signInToPicker,
} from "./support";

test.beforeEach(async ({ request }) => {
  await request.post(`${BACKEND_URL}/__test__/reset`);
});

test("from Directory › Organizations, and back", async ({ page }) => {
  await signIn(page, ADMIN.email);
  await page.goto("/organizations");
  await hydrated(page);
  await page.getByRole("button", { name: "New organization" }).click();
  await expect(page).toHaveURL(/\/create-organization\?from=organizations$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create an organisation");
  await page.getByRole("radio", { name: "Pro" }).click();
  await page.getByRole("button", { name: "Continue with Pro" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell us about your project");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/organizations$/);
});

test("from the organisation picker, and back", async ({ page }) => {
  await signInToPicker(page);
  await page.getByRole("button", { name: "Create a new organisation" }).click();
  await expect(page).toHaveURL(/\/create-organization\?from=select-organization$/);
  await expect(page.getByRole("radio", { name: "Free" })).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/select-organization$/);
});

test("a new account with no organisation goes straight to setting one up", async ({ page }) => {
  await signInToEntry(page, FRESH.email, "/create-organization");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set up your organisation");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  // The console itself has nothing to show it yet.
  await page.goto("/users");
  await expect(page).toHaveURL(/\/create-organization$/);
});

test("a new account opens My account in the console, and nothing else of it", async ({ page }) => {
  await signInToEntry(page, FRESH.email, "/create-organization");
  await page.goto("/account/profile");
  await expect(page).toHaveURL(/\/account\/profile$/);
  await hydrated(page);
  const nav = page.getByRole("navigation", { name: "Qeet ID" });
  await expect(nav.getByRole("link", { name: "My account" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.getByText("Not in an organisation yet")).toBeVisible();
  await page.getByRole("link", { name: "Choose an organisation" }).click();
  await expect(page).toHaveURL(/\/(select|create)-organization$/);
});

test("a new account that was invited sees the invitation, not the plans", async ({ page }) => {
  await signInToEntry(page, INVITED.email, "/select-organization");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Join Org Two");
  await expect(page.getByRole("button", { name: "Join Org Two" })).toBeVisible();
  await page.getByRole("button", { name: "Create a new organisation instead" }).click();
  await expect(page).toHaveURL(/\/create-organization\?from=select-organization$/);
});
