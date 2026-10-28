// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t-1",
  useUserId: () => "u-me",
  useSessionId: () => "s-1",
}));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/authorization/testing", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
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
vi.mock("@/modules/authorization/components/shared/monaco-panel", () => ({
  MonacoPanel: () => null,
}));
// A native select stands in for the searchable combobox, which jsdom can't drive reliably.
vi.mock("@qeetrix/react/experimental", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@qeetrix/react/experimental")>()),
  Combobox: ({
    items,
    value,
    placeholder,
    onValueChange,
  }: {
    items: { label: string; value: string }[];
    value: string | null;
    placeholder?: string;
    onValueChange: (v: string | null) => void;
  }) => (
    <select
      aria-label={placeholder}
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value || null)}
    >
      <option value="" />
      {items.map((i) => (
        <option key={i.value} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  ),
}));

import { TestingPage } from "@/modules/authorization/pages";
import { clearHistory, pushDecision } from "@/modules/authorization/store/authz-store";
import { api } from "@/platform/api/client";

const AARAV = "55019a2c-0000-4000-8000-000000000002";

beforeEach(() => {
  granted.except = new Set();
  clearHistory();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/v1/check")
      return {
        allowed: true,
        paths: [
          {
            permission: "role.write",
            granted_by: "role:Admin",
            via: "direct",
            role_id: "55019a2c-1111-4000-8000-000000000003",
          },
        ],
        decided_by: {
          model: "rbac",
          reason_code: "authz.role_grant",
          reason_params: { permission: "role.write" },
        },
        trace: [
          "tenant: t-1",
          "abac: no policy can change this, skipped",
          "rbac: a role grants role.write, allowed",
        ],
      };
    if (path === "/v1/permissions")
      return { items: [{ id: "p1", key: "role.write", description: "Change roles" }] };
    if (path === `/v1/users/${AARAV}/access`)
      return {
        roles: [{ id: "r1", name: "Admin" }],
        groups: [{ id: "g1", name: "Engineering" }],
        permissions_direct: 25,
        permissions_inherited: 0,
        permissions_total: 25,
      };
    if (path === "/v1/users")
      return {
        items: [
          {
            id: AARAV,
            tenant_id: "t-1",
            email: "aarav@qeet.in",
            display_name: "Aarav Mehta",
            status: "active",
            metadata: { department: "Engineering", title: "VP Engineering" },
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      };
    throw new Error(`Unexpected request ${path}`);
  });
});
afterEach(cleanup);

function renderPage(userId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TestingPage mode="permission" onModeChange={vi.fn()} userId={userId} />
    </QueryClientProvider>,
  );
}

describe("Testing › a permission", () => {
  it("asks the composed check, and shows the answer, the role that grants it and the trace", async () => {
    renderPage(AARAV);
    const permission = await screen.findByRole("combobox", { name: "user.read" });
    await within(permission).findByRole("option", { name: "role.write" });
    fireEvent.change(permission, { target: { value: "role.write" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("Can Aarav Mehta use role.write?")).toBeTruthy();
    expect(screen.getByText("A role grants role.write.")).toBeTruthy();
    const grants = screen.getByRole("table", { name: "Grant paths" });
    expect(within(grants).getByText("Admin")).toBeTruthy();
    expect(within(grants).getByText("Assigned directly")).toBeTruthy();
    expect(vi.mocked(api)).toHaveBeenCalledWith(
      "/v1/check",
      expect.objectContaining({
        query: expect.objectContaining({
          user_id: AARAV,
          permission: "role.write",
          explain: "true",
        }),
      }),
    );
    // The person it's about, from GET /v1/users/{id}/access.
    expect(await screen.findByText("VP Engineering")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Trace/ }));
    expect(await screen.findByText("No attribute policy can change this")).toBeTruthy();
    expect(screen.getByText("A role grants role.write")).toBeTruthy();
  });

  it("keeps the decision in this tab's list, where it opens again", async () => {
    act(() =>
      pushDecision({
        id: "d1",
        engine: "rbac",
        allowed: false,
        at: new Date().toISOString(),
        durationMs: 3,
        input: { user_id: AARAV, permission: "user.write" },
        rbac: { allowed: false, paths: [], reason_code: "authz.no_role_grant" },
      }),
    );
    renderPage();
    const list = await screen.findByRole("region", { name: "This tab" });
    fireEvent.click(await within(list).findByRole("button", { name: /Aarav Mehta/ }));
    expect(await screen.findByText("Can Aarav Mehta use user.write?")).toBeTruthy();
    expect(
      screen.getByText("No role grants this permission to this person in this organisation."),
    ).toBeTruthy();
    await waitFor(() =>
      expect(vi.mocked(api).mock.calls.some(([p]) => p === "/v1/check")).toBe(false),
    );
  });
});
