// @vitest-environment jsdom
import { SidebarProvider } from "@qeetrix/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/directory", searchStr: "", hash: "" }),
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children?: ReactNode }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
}));

import { getNavGroups, translateNavigation } from "@/platform/config/navigation";
import { SectionNav } from "../components/nav-main";

afterEach(cleanup);

describe("SectionNav", () => {
  it("expands Directory branches and links to every completed view", () => {
    const group = translateNavigation(getNavGroups()).find((item) => item.id === "directory");
    if (!group) throw new Error("Directory navigation is missing");
    render(
      <SidebarProvider>
        <SectionNav
          group={group}
          badges={{
            "/invitations": { label: "12", description: "12 pending invitations", tone: "warning" },
          }}
        />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Users" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "Invitations: 12 pending invitations" })).toBeTruthy();
    for (const [title, path] of [
      ["Suspended", "/users/suspended"],
      ["Connections", "/directory/connections"],
      ["Sync activity", "/directory/sync-activity"],
      ["Sync errors", "/directory/sync-errors"],
      ["Mappings", "/directory/attribute-mappings"],
    ]) {
      const item = screen.getByRole("link", { name: title });
      expect(item.getAttribute("href")).toBe(path);
      expect(item.getAttribute("aria-disabled")).not.toBe("true");
    }
    fireEvent.click(screen.getByRole("button", { name: "Users" }));
    expect(screen.getByRole("button", { name: "Users" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});
