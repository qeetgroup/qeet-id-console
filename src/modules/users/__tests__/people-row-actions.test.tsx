// @vitest-environment jsdom
import { Menu, MenuContent, MenuTrigger } from "@qeetrix/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/modules/groups", () => ({
  useGroups: () => ({ data: { items: [{ id: "grp-eng", name: "Engineering" }] } }),
}));

import type { User } from "../api/users";
import { PeopleRowActions, type PeopleRowHandlers } from "../components/people/people-table";

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

function handlers() {
  return {
    actions: {
      resetMfa: vi.fn(),
      setMfaRequired: vi.fn(),
      revokeSessions: vi.fn(),
      suspend: vi.fn(),
      reactivate: vi.fn(),
      remove: vi.fn(),
    },
    run: vi.fn(),
    onEdit: vi.fn(),
    onSetPassword: vi.fn(),
  };
}

async function openMenu(target = user(), isSelf = false) {
  const h = handlers();
  render(
    <Menu>
      <MenuTrigger>Actions</MenuTrigger>
      <MenuContent>
        <PeopleRowActions
          user={target}
          isSelf={isSelf}
          handlers={h as unknown as PeopleRowHandlers}
        />
      </MenuContent>
    </Menu>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  await screen.findByRole("menu");
  return h;
}

const item = (name: string) => screen.getByRole("menuitem", { name });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PeopleRowActions", () => {
  it("changes a role on the person's access tab", async () => {
    await openMenu();
    expect(item("Change role").getAttribute("href")).toBe("/users/user-1?tab=access");
  });

  it("hands each action the row's person", async () => {
    const target = user({ mfa_enabled: false });
    const h = await openMenu(target);
    for (const name of [
      "Edit profile",
      "Set password",
      "Require two-step verification",
      "Sign out everywhere",
      "Suspend",
      "Delete user",
    ]) {
      fireEvent.click(item(name));
      fireEvent.click(screen.getByRole("button", { name: "Actions" }));
      await screen.findByRole("menu");
    }
    expect(h.onEdit).toHaveBeenCalledWith(target);
    expect(h.onSetPassword).toHaveBeenCalledWith(target);
    expect(h.actions.setMfaRequired).toHaveBeenCalledWith(target, true);
    expect(h.actions.revokeSessions).toHaveBeenCalledWith(target);
    expect(h.actions.suspend).toHaveBeenCalledWith(target);
    expect(h.actions.remove).toHaveBeenCalledWith(target);
  });

  it("offers a reset instead of a requirement once two-step is on", async () => {
    const target = user({ mfa_enabled: true });
    const h = await openMenu(target);
    expect(screen.queryByRole("menuitem", { name: "Require two-step verification" })).toBeNull();
    fireEvent.click(item("Reset two-step verification"));
    expect(h.actions.resetMfa).toHaveBeenCalledWith(target);
  });

  it("offers reactivation instead of suspension for a suspended person", async () => {
    const target = user({ status: "suspended" });
    const h = await openMenu(target);
    expect(screen.queryByRole("menuitem", { name: "Suspend" })).toBeNull();
    fireEvent.click(item("Reactivate"));
    expect(h.actions.reactivate).toHaveBeenCalledWith(target);
  });

  it("does not let admins suspend or delete themselves", async () => {
    await openMenu(user(), true);
    expect(item("Suspend").getAttribute("aria-disabled")).toBe("true");
    expect(item("Delete user").getAttribute("aria-disabled")).toBe("true");
  });

  it("adds the person to a group from its submenu", async () => {
    const h = await openMenu();
    fireEvent.click(item("Add to a group"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Engineering" }));
    expect(h.run).toHaveBeenCalledWith("Add to a group", ["user-1"], expect.any(Function));
  });
});
