// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t1",
  useUserId: () => "u-me",
  useSessionId: () => "session-1",
}));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/users/deleted", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { DeletedUsersPage } from "../pages";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const BIN = [
  {
    id: "u-anil",
    email: "anil@qeet.in",
    display_name: "Anil Bhatia",
    deleted_at: ago(17),
    deleted_by: "u-me",
    created_at: ago(400),
  },
  {
    id: "u-ravi",
    email: "ravi@qeet.in",
    display_name: "Ravi Kumar",
    deleted_at: ago(85.5),
    deleted_by: "u-arjun",
    created_at: ago(500),
  },
];

beforeEach(() => {
  granted.except = new Set();
  vi.spyOn(toast, "success").mockImplementation(() => "");
  vi.mocked(api).mockImplementation(async (path: string, opts?: { method?: string }) => {
    const method = opts?.method ?? "GET";
    if (method === "GET") {
      if (path === "/v1/users/deleted") return { items: BIN };
      if (path === "/v1/tenants/t1/retention")
        return { deleted_users_enabled: true, deleted_users_days: 90 };
      if (path === "/v1/users")
        return {
          items: [
            {
              id: "u-arjun",
              tenant_id: "t1",
              email: "arjun@qeet.in",
              display_name: "Arjun Rao",
              status: "active",
              created_at: ago(300),
            },
          ],
        };
      if (path === "/v1/tenants/t1/invites") return { items: [] };
    }
    if (path.endsWith("/restore") && method === "POST") return undefined;
    if (path.endsWith("/purge") && method === "DELETE") return undefined;
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(api).mockReset();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <DeletedUsersPage filters={{}} onFiltersChange={vi.fn()} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, o]) => (o as { method?: string } | undefined)?.method)
    .map(([p, o]) => `${(o as { method: string }).method} ${p}`);
async function rowOf(name: string) {
  const table = await screen.findByRole("table", { name: "Deleted" });
  return (await within(table).findByText(name)).closest("tr") as HTMLElement;
}

describe("the Deleted tab", () => {
  it("shows the recycle bin's rule: who's purged next, when, and how long people are kept", async () => {
    renderPage();
    expect(await screen.findByText("Restorable until they're purged")).toBeTruthy();
    const next = (await screen.findByText("Next purge")).closest(".ppl-cell") as HTMLElement;
    expect(within(next).getByText("in 5 days")).toBeTruthy();
    expect(within(next).getByText(/Ravi Kumar/)).toBeTruthy();
    expect(screen.getByText("90 days")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Change in Compliance › Retention →" }).getAttribute("href"),
    ).toBe("/security/compliance/retention");
  });

  it("names who deleted each person and when they're purged", async () => {
    renderPage();
    const anil = await rowOf("Anil Bhatia");
    expect(within(anil).getByText("You")).toBeTruthy();
    expect(within(anil).getByText("in 73 days")).toBeTruthy();
    expect(within(await rowOf("Ravi Kumar")).getByText("Arjun Rao")).toBeTruthy();
  });

  it("restores straight away, and deletes forever only after the admin confirms", async () => {
    renderPage();
    const anil = await rowOf("Anil Bhatia");
    fireEvent.click(within(anil).getAllByRole("button").at(-1) as HTMLElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Restore" }));
    await waitFor(() => expect(writes()).toEqual(["POST /v1/users/u-anil/restore"]));

    fireEvent.click(within(anil).getAllByRole("button").at(-1) as HTMLElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete forever…" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("anil@qeet.in");
    expect(writes()).toEqual(["POST /v1/users/u-anil/restore"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete forever" }));
    await waitFor(() => expect(writes()).toContain("DELETE /v1/users/u-anil/purge"));
  });

  it("doesn't read the retention rules without policy.read, and leaves out purge dates", async () => {
    granted.except = new Set(["policy.read"]);
    renderPage();
    await rowOf("Anil Bhatia");
    expect(screen.getByText("Set in Compliance › Retention")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Purged" })).toBeNull();
    expect(vi.mocked(api).mock.calls.some(([p]) => p === "/v1/tenants/t1/retention")).toBe(false);
  });
});
