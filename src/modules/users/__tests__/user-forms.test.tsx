// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-a" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/invitations">{children}</a>,
}));
vi.mock("@/modules/authorization", () => ({
  useRoles: () => ({
    isLoading: false,
    data: {
      items: [
        { id: "role-admin", name: "Admin" },
        { id: "role-member", name: "Member" },
      ],
    },
  }),
}));
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "tenant-a", name: "Acme" }] } }),
}));

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

import type { User } from "../api/users";
import { CreateUserSheet } from "../components/create-user-sheet";
import { EditUserSheet } from "../components/edit-user-sheet";
import { SetPasswordSheet } from "../components/set-password-sheet";

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{ui}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const asha: User = {
  id: "user-1",
  tenant_id: "tenant-a",
  email: "asha@example.test",
  display_name: "Asha",
  status: "active",
  created_at: "2026-09-01T00:00:00Z",
};

function type(name: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
}

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue({ id: "new-user" });
});

afterEach(cleanup);

describe("CreateUserSheet", () => {
  it("names each problem on its field and sends nothing", async () => {
    renderWithProviders(<CreateUserSheet open onOpenChange={vi.fn()} tenantId="tenant-a" />);

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("creates the user with an E.164 phone and the default member role", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<CreateUserSheet open onOpenChange={onOpenChange} tenantId="tenant-a" />);

    type(/^Email/, "bea@example.test");
    type(/^Phone/, "555 555 0100");
    type(/^Initial password/, "correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(vi.mocked(api).mock.calls[0]).toEqual([
      "/v1/users",
      {
        method: "POST",
        body: {
          tenant_id: "tenant-a",
          email: "bea@example.test",
          password: "correct horse",
          phone: expect.stringMatching(/^\+\d+5555550100$/),
        },
      },
    ]);
    expect(vi.mocked(api).mock.calls[1]?.[0]).toBe(
      "/v1/users/new-user/tenants/tenant-a/roles/role-member",
    );
  });

  it("marks the field a 422 names, in the console's words", async () => {
    vi.mocked(api).mockRejectedValue(
      new ApiError(422, "validation_failed", "backend text", undefined, false, undefined, {
        requestId: "req-7",
        fields: [{ field: "email", code: "invalid_email" }],
      }),
    );
    renderWithProviders(<CreateUserSheet open onOpenChange={vi.fn()} tenantId="tenant-a" />);

    type(/^Email/, "bea@example.test");
    type(/^Initial password/, "correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("req-7")).toBeTruthy();
    expect(screen.queryByText("backend text")).toBeNull();
  });
});

describe("EditUserSheet", () => {
  it("saves profile changes without a confirmation", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<EditUserSheet user={asha} isSelf={false} onOpenChange={onOpenChange} />);

    type(/^Display name/, "Asha R");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(api).toHaveBeenCalledWith("/v1/users/user-1", {
      method: "PATCH",
      body: { display_name: "Asha R", phone: null, status: "active" },
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("refuses a phone number that isn't E.164", async () => {
    renderWithProviders(<EditUserSheet user={asha} isSelf={false} onOpenChange={vi.fn()} />);

    type(/^Phone/, "555-0100");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Use E.164 format, such as +15555550100.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("SetPasswordSheet", () => {
  it("refuses passwords that don't match", async () => {
    renderWithProviders(<SetPasswordSheet user={asha} onOpenChange={vi.fn()} />);

    type(/^New password/, "correct horse");
    type(/^Confirm new password/, "correct house");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Passwords don’t match")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("sets the password and closes", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<SetPasswordSheet user={asha} onOpenChange={onOpenChange} />);

    type(/^New password/, "correct horse");
    type(/^Confirm new password/, "correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(api).toHaveBeenCalledWith("/v1/users/user-1/password", {
      method: "POST",
      body: { password: "correct horse" },
    });
  });
});

describe("EditUserSheet suspension", () => {
  it("asks for the suspend confirmation before suspending, and sends nothing if cancelled", async () => {
    renderWithProviders(<EditUserSheet user={asha} isSelf={false} onOpenChange={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Status/ }), { button: 0 });
    const suspended = await screen.findByRole("option", { name: "Suspended" });
    fireEvent.pointerDown(suspended, { pointerType: "mouse", button: 0 });
    fireEvent.click(suspended);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Suspend this user?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api).not.toHaveBeenCalled();
  });
});
