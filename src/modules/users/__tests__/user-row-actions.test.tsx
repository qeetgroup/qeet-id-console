// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

// Render router links as plain anchors whose href is the resolved destination.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    params?: { userId: string };
    search?: Record<string, string>;
  }) => {
    const path = to.replace("$userId", params?.userId ?? "");
    const query = search ? `?${new URLSearchParams(search).toString()}` : "";
    return <a {...props} href={`${path}${query}`} />;
  },
}));

import type { User } from "../api/users";
import { type RowActionHandlers, UserRowActions } from "../user-row-actions";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    tenant_id: "tenant-a",
    email: "asha@example.test",
    status: "active",
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function handlers(): RowActionHandlers {
  return {
    onEdit: vi.fn(),
    onSetPassword: vi.fn(),
    onResetMfa: vi.fn(),
    onRevokeSessions: vi.fn(),
    onToggleSuspend: vi.fn(),
    onDelete: vi.fn(),
  };
}

async function openMenu(props: Partial<ComponentProps<typeof UserRowActions>> = {}) {
  const h = props.handlers ?? handlers();
  const target = props.user ?? user();
  render(
    <UserRowActions
      user={target}
      canWrite={props.canWrite ?? true}
      isSelf={props.isSelf ?? false}
      handlers={h}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  await screen.findByRole("menu");
  return { handlers: h, user: target };
}

function item(name: string) {
  return screen.getByRole("menuitem", { name });
}

beforeEach(() => {
  vi.spyOn(toast, "success").mockImplementation(() => "");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UserRowActions", () => {
  it("links into the user's 360 view, access tab and activity timeline", async () => {
    await openMenu();

    expect(item("View user").getAttribute("href")).toBe("/users/user-1");
    expect(item("Manage access").getAttribute("href")).toBe("/users/user-1?tab=access");
    expect(item("View activity").getAttribute("href")).toBe("/users/user-1/timeline");
  });

  it("offers only navigation and copying to a read-only admin", async () => {
    await openMenu({ canWrite: false });

    expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toEqual([
      "View user",
      "Manage access",
      "View activity",
      "Copy user ID",
    ]);
  });

  it("hands each mutating action the row's user", async () => {
    const { handlers: h, user: target } = await openMenu();

    fireEvent.click(item("Edit profile"));
    expect(h.onEdit).toHaveBeenCalledWith(target);

    for (const [name, handler] of [
      ["Set password", h.onSetPassword],
      ["Reset MFA", h.onResetMfa],
      ["Revoke all sessions", h.onRevokeSessions],
      ["Suspend user", h.onToggleSuspend],
      ["Delete user", h.onDelete],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: "Actions" }));
      fireEvent.click(await screen.findByRole("menuitem", { name }));
      expect(handler).toHaveBeenCalledWith(target);
    }
  });

  it("offers reactivation instead of suspension for a suspended user", async () => {
    await openMenu({ user: user({ status: "suspended" }) });

    expect(item("Reactivate user")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Suspend user" })).toBeNull();
  });

  it("does not let admins suspend or delete themselves", async () => {
    const { handlers: h } = await openMenu({ isSelf: true });

    for (const name of ["Suspend user", "Delete user"]) {
      expect(item(name).getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(item(name));
    }
    expect(h.onToggleSuspend).not.toHaveBeenCalled();
    expect(h.onDelete).not.toHaveBeenCalled();
    expect(item("Edit profile").getAttribute("aria-disabled")).toBeNull();
  });

  it("copies the user's id and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await openMenu();

    fireEvent.click(item("Copy user ID"));

    expect(writeText).toHaveBeenCalledWith("user-1");
    expect(toast.success).toHaveBeenCalledWith("User ID copied");
  });
});
