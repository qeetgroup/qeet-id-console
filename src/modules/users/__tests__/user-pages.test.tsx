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
  useLocation: () => ({ pathname: "/users/import" }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "tenant-a", name: "Acme" }] } }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

import { ImportUsersPage } from "../pages";

let bulk: unknown = { succeeded: 0, failed: 0 };
let members: { email: string }[] = [];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <ImportUsersPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  bulk = { succeeded: 0, failed: 0 };
  members = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path: string) => {
    if (path === "/v1/users") return { items: members, next_cursor: "" };
    if (path === "/v1/users/bulk") return bulk;
    return { items: [] };
  });
});
afterEach(cleanup);

function upload(name: string, text: string) {
  const file = new File([text], name, { type: "text/csv" });
  fireEvent.change(screen.getByLabelText(/^People file/), { target: { files: [file] } });
}

const bulkCall = () => vi.mocked(api).mock.calls.find(([path]) => path === "/v1/users/bulk");

describe("ImportUsersPage", () => {
  it("names a row without an email when checking, and leaves it out of the import", async () => {
    bulk = { succeeded: 1, failed: 0 };
    renderPage();

    upload("users.csv", "email,display_name\na@example.test,Asha\n,Nobody\n");

    expect(await screen.findByText("Email is missing.")).toBeTruthy();
    expect(screen.getByText("1 row is left out")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import 1 person" }));

    await waitFor(() =>
      expect(bulkCall()?.[1]).toEqual({
        method: "POST",
        body: { tenant_id: "tenant-a", users: [{ email: "a@example.test", display_name: "Asha" }] },
      }),
    );
    expect(await screen.findByText("1 person added to Acme")).toBeTruthy();
  });

  it("leaves out an address already here or used twice, before the server would refuse it", async () => {
    members = [{ email: "a@example.test" }];
    renderPage();

    upload("users.csv", "email\nA@example.test\nb@example.test\nb@example.test\n");

    expect(await screen.findByText("Already in the organisation")).toBeTruthy();
    expect(screen.getByText("On an earlier line too")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import 1 person" })).toBeTruthy();
  });

  it("lists each refused row by its line in the file, in the console's words", async () => {
    bulk = {
      succeeded: 1,
      failed: 1,
      errors: [{ line: 2, email: "b@example.test", code: "auth.email_exists", message: "dup" }],
    };
    renderPage();

    upload("users.csv", "email\na@example.test\n\nb@example.test\n");
    fireEvent.click(await screen.findByRole("button", { name: "Import 2 people" }));

    const table = await screen.findByRole("table", { name: "Not imported" });
    const row = within(table).getByText("A user with this email already exists.").closest("tr");
    expect(row?.textContent).toContain("4");
    expect(screen.queryByText("dup")).toBeNull();
  });

  it("refuses more people than one import can take", async () => {
    renderPage();

    const rows = Array.from({ length: 1001 }, (_, i) => `u${i}@example.test`).join("\n");
    upload("users.csv", `email\n${rows}\n`);

    expect(await screen.findByText("One import takes up to 1,000 people")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Import 1,001 people" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });
});
