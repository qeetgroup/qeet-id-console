// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

import type { User } from "../api/users";
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

describe("EditUserSheet", () => {
  it("saves profile changes without a confirmation", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<EditUserSheet user={asha} onOpenChange={onOpenChange} />);

    type(/^Name/, "Asha R");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(api).toHaveBeenCalledWith("/v1/users/user-1", {
      method: "PATCH",
      body: { display_name: "Asha R", phone: null },
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("refuses a phone number that isn't E.164", async () => {
    renderWithProviders(<EditUserSheet user={asha} onOpenChange={vi.fn()} />);

    type(/^Phone/, "555-0100");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Use E.164 format, such as +15555550100.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("SetPasswordSheet", () => {
  it("says what setting it does to them before anything is sent", () => {
    renderWithProviders(<SetPasswordSheet user={asha} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Asha is signed out everywhere")).toBeTruthy();
    expect(screen.getByText(/emails them that it changed/)).toBeTruthy();
  });

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
