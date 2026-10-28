// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t1", useUserId: () => "u-me" }));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
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
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t1", name: "Qeet Group" }] } }),
}));

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { AddPeopleDrawer } from "../components/add-people/add-people-drawer";

beforeEach(() => {
  granted.except = new Set();
  vi.spyOn(toast, "success").mockImplementation(() => "");
  vi.mocked(api).mockImplementation(async (path: string, opts?: { method?: string }) => {
    const method = opts?.method ?? "GET";
    if (method === "GET") {
      if (path === "/v1/users")
        return {
          items: [
            {
              id: "u-priya",
              tenant_id: "t1",
              email: "priya@qeet.in",
              status: "active",
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
        };
      if (path === "/v1/tenants/t1/invites")
        return {
          items: [
            {
              id: "i-sai",
              tenant_id: "t1",
              email: "sai@qeet.in",
              status: "pending",
              expires_at: "2026-11-09T00:00:00Z",
              created_at: "2026-10-26T00:00:00Z",
            },
          ],
        };
      if (path === "/v1/tenants/t1/roles")
        return {
          items: [
            {
              id: "role-admin",
              name: "Admin",
              description: "Full administrative access to the organisation",
            },
            {
              id: "role-member",
              name: "Member",
              description: "Standard access: sees the directory, changes nothing",
            },
          ],
        };
    }
    if (path === "/v1/invites" && method === "POST") return { invite: {} };
    if (path === "/v1/invites/i-sai/resend" && method === "POST") return { invite: {} };
    if (path === "/v1/users" && method === "POST") return { id: "new-user" };
    if (path === "/v1/users/new-user/tenants/t1/roles/role-member" && method === "POST")
      return undefined;
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(api).mockReset();
});

function renderDrawer(mode?: "invite" | "create") {
  const onOpenChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <AddPeopleDrawer open onOpenChange={onOpenChange} mode={mode} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onOpenChange };
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, o]) => (o as { method?: string } | undefined)?.method)
    .map(([p, o]) => `${(o as { method: string }).method} ${p}`);
const field = (name: RegExp) => screen.getByRole("textbox", { name });

describe("Add people › invite by email", () => {
  it("checks each address first, then sends the new ones and the waiting one again", async () => {
    const { onOpenChange } = renderDrawer();
    await screen.findByText("Member: Standard access: sees the directory, changes nothing");
    fireEvent.change(field(/Email addresses/), {
      target: { value: "kavya@qeet.in, sai@qeet.in\npriya@qeet.in\nnot-an-email" },
    });

    const checks = within(screen.getByRole("region", { name: "What happens to each address" }));
    expect(checks.getByText("New invitation")).toBeTruthy();
    expect(checks.getByText("Already invited · we'll send it again")).toBeTruthy();
    expect(checks.getByText("Already a member · skipped")).toBeTruthy();
    expect(checks.getByText("Not an email address")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send 2 invitations" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(writes().sort()).toEqual(["POST /v1/invites", "POST /v1/invites/i-sai/resend"]);
    const body = vi
      .mocked(api)
      .mock.calls.find(([p, o]) => p === "/v1/invites" && o?.method === "POST")?.[1]?.body;
    expect(body).toEqual({ tenant_id: "t1", email: "kavya@qeet.in", role_id: "role-member" });
    expect(toast.success).toHaveBeenCalledWith("Sent 2 invitations");
  });

  it("sends nothing when every address is already a member", async () => {
    renderDrawer();
    await screen.findByText(/Standard access/);
    fireEvent.change(field(/Email addresses/), { target: { value: "priya@qeet.in" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitations" }));
    expect(
      await screen.findByText("Add at least one email address that isn't already a member."),
    ).toBeTruthy();
    expect(writes()).toEqual([]);
  });
});

describe("Add people › create the account now", () => {
  it("names each problem on its field and sends nothing", async () => {
    renderDrawer("create");
    fireEvent.click(await screen.findByRole("button", { name: "Create user" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(writes()).toEqual([]);
  });

  it("won't create someone who's already a member", async () => {
    renderDrawer("create");
    await screen.findByText(/Standard access/);
    fireEvent.change(field(/Work email/), { target: { value: "priya@qeet.in" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(await screen.findByText("Already a member of this organisation.")).toBeTruthy();
  });

  it("creates the user with an E.164 phone and the default member role", async () => {
    const { onOpenChange } = renderDrawer("create");
    await screen.findByText(/Standard access/);
    fireEvent.change(field(/Work email/), { target: { value: "bea@qeet.in" } });
    fireEvent.change(field(/^Name/), { target: { value: " Bea Kapoor " } });
    fireEvent.change(field(/^Phone/), { target: { value: "+91 98765 43210" } });
    fireEvent.change(screen.getByLabelText(/First password/), {
      target: { value: "correct horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(
      vi.mocked(api).mock.calls.find(([p, o]) => p === "/v1/users" && o?.method === "POST")?.[1]
        ?.body,
    ).toEqual({
      tenant_id: "t1",
      email: "bea@qeet.in",
      password: "correct horse",
      display_name: "Bea Kapoor",
      phone: "+919876543210",
    });
    expect(writes()).toContain("POST /v1/users/new-user/tenants/t1/roles/role-member");
  });

  it("marks the field a 422 names, in the console's words, with the request's reference", async () => {
    vi.mocked(api).mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (opts?.method === "POST")
        throw new ApiError(422, "validation_failed", "backend text", undefined, false, undefined, {
          requestId: "req-7",
          fields: [{ field: "email", code: "invalid_email" }],
        });
      if (path === "/v1/tenants/t1/roles")
        return { items: [{ id: "role-member", name: "Member", description: "" }] };
      return { items: [] };
    });
    renderDrawer("create");
    fireEvent.change(field(/Work email/), { target: { value: "bea@qeet.in" } });
    fireEvent.change(screen.getByLabelText(/First password/), {
      target: { value: "correct horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("req-7")).toBeTruthy();
    expect(screen.queryByText("backend text")).toBeNull();
  });

  it("offers only invitations to someone who can't assign roles", async () => {
    granted.except = new Set(["role.write"]);
    renderDrawer("create");
    expect(await screen.findByRole("textbox", { name: /Email addresses/ })).toBeTruthy();
    expect(screen.queryByText("Create the account now")).toBeNull();
  });
});
