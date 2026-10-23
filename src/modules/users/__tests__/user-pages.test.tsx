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
  Link: ({ children }: { children: ReactNode }) => <a href="/users">{children}</a>,
  useLocation: () => ({ pathname: "/users/deleted" }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

import { DeletedUsersPage } from "../components/deleted-users-page";
import { ImportUsersPage } from "../components/import-users-page";

function renderPage(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{ui}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.mocked(api).mockReset());
afterEach(cleanup);

describe("DeletedUsersPage", () => {
  beforeEach(() => {
    vi.mocked(api).mockImplementation(async (path) =>
      path === "/v1/users/deleted"
        ? {
            items: [
              {
                id: "user-1",
                email: "asha@example.test",
                display_name: null,
                deleted_at: "2026-10-01T00:00:00Z",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
          }
        : undefined,
    );
  });

  it("purges a user for good only after the admin confirms", async () => {
    renderPage(<DeletedUsersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Delete forever/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Permanently delete asha@example.test?");
    expect(api).not.toHaveBeenCalledWith("/v1/users/user-1/purge", { method: "DELETE" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete forever" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/user-1/purge", { method: "DELETE" }),
    );
  });

  it("restores a user without a confirmation", async () => {
    renderPage(<DeletedUsersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Restore/ }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/user-1/restore", { method: "POST" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("ImportUsersPage", () => {
  function upload(name: string, text: string) {
    const file = new File([text], name, { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/Drop your CSV or NDJSON file/), {
      target: { files: [file] },
    });
  }

  it("names a row without an email in the preview and leaves it out of the import", async () => {
    vi.mocked(api).mockResolvedValue({ succeeded: 1, failed: 0 });
    renderPage(<ImportUsersPage />);

    upload("users.csv", "email,display_name\na@example.test,Asha\n,Nobody\n");

    expect(await screen.findByText("Email is missing.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import 1 user" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/users/bulk", {
        method: "POST",
        body: { tenant_id: "tenant-a", users: [{ email: "a@example.test", display_name: "Asha" }] },
      }),
    );
  });

  it("shows each refused row by its file line, in the console's words", async () => {
    vi.mocked(api).mockResolvedValue({
      succeeded: 1,
      failed: 1,
      errors: [{ line: 2, email: "b@example.test", code: "auth.email_exists", message: "dup" }],
    });
    renderPage(<ImportUsersPage />);

    upload("users.csv", "email\na@example.test\n\nb@example.test\n");
    fireEvent.click(await screen.findByRole("button", { name: "Import 2 users" }));

    const row = (await screen.findByText("A user with this email already exists.")).closest("tr");
    expect(row?.textContent).toContain("4");
    expect(screen.queryByText("dup")).toBeNull();
  });

  it("refuses more users than one import can take", async () => {
    renderPage(<ImportUsersPage />);

    const rows = Array.from({ length: 1001 }, (_, i) => `u${i}@example.test`).join("\n");
    upload("users.csv", `email\n${rows}\n`);

    expect(await screen.findByText(/at most 1,000 users/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import 1001 users" }).matches(":disabled")).toBe(
      true,
    );
  });
});
