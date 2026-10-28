// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1", useUserId: () => "u-me" }));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useLocation: () => ({ pathname: "/security/compliance/gdpr", searchStr: "", hash: "" }),
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each sensitive action asked for, then runs it through the real provider.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (options: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(options);
        return run(options);
      };
    },
  };
});

import { formatDate } from "@qeetrix/react";

import { formatLocale } from "@/i18n";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./gdpr";

const Page = Route.options.component as () => React.JSX.Element;

const ANIL = "11111111-2222-3333-4444-555555555555";
const REQUEST = {
  id: "purge-1",
  tenant_id: "t-1",
  user_id: ANIL,
  requested_by: "u-me",
  reason: "Former employee, asked by email",
  status: "pending",
  grace_until: "2026-11-20T08:00:00Z",
  created_at: "2026-10-21T08:00:00Z",
};
const PEOPLE = [
  {
    id: "u-me",
    tenant_id: "t-1",
    email: "priya@qeet.in",
    display_name: "Priya Nair",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
  },
];
const DELETED = [
  {
    id: ANIL,
    email: "anil.bhatia@qeet.in",
    display_name: "Anil Bhatia",
    deleted_at: "2026-10-10T03:38:00Z",
    created_at: "2025-01-01T00:00:00Z",
  },
];

let requests: unknown[] = [];
const erasedOn = () => formatDate(REQUEST.grace_until, formatLocale());

// jsdom has no Web Animations; the tables' ScrollArea asks for them after a scroll.
beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
});

beforeEach(() => {
  granted.except = new Set();
  sensitiveCalls.length = 0;
  requests = [REQUEST];
  vi.mocked(api).mockImplementation(async (path: string, options?: { method?: string }) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/gdpr/purge" && method === "GET") return { items: requests };
    if (path === "/v1/gdpr/purge" && method === "POST") return REQUEST;
    if (path === "/v1/gdpr/purge/purge-1" && method === "DELETE") return undefined;
    if (path === "/v1/users") return { items: PEOPLE };
    if (path === "/v1/users/deleted") return { items: DELETED };
    if (path === "/v1/tenants/t-1/compliance/iso27001/evidence") return { items: [] };
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <Page />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const changes = () =>
  vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));

describe("Compliance › GDPR erasure", () => {
  it("names the person, deleted ones included, and when their data is erased", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Erasure requests" });
    const row = (await within(table).findByText("Anil Bhatia")).closest("tr") as HTMLElement;
    expect(within(row).getByText("anil.bhatia@qeet.in")).toBeTruthy();
    expect(within(row).getByText("Pending")).toBeTruthy();
    expect(within(row).getByText(erasedOn())).toBeTruthy();
    expect(within(row).getByText("by Priya Nair")).toBeTruthy();
    expect(screen.getByText("1 pending")).toBeTruthy();
    expect(screen.getByText(`${erasedOn()} · Anil Bhatia`)).toBeTruthy();
  });

  it("withdraws a request through the shared confirm, which says what it keeps", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Anil Bhatia" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Withdraw request" }));

    const title = await screen.findByText("Withdraw the request to erase Anil Bhatia?");
    const dialog = title.closest('[role="alertdialog"], [role="dialog"]') as HTMLElement;
    const long = formatDate(REQUEST.grace_until, formatLocale(), { dateStyle: "long" });
    expect(within(dialog).getByText(new RegExp(`won't be erased on ${long}`))).toBeTruthy();
    expect(changes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw request" }));
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/gdpr/purge/purge-1"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Withdraw an erasure request");
  });

  it("files a request for a person's ID as a sensitive action, without a confirmation", async () => {
    granted.except = new Set(["user.read"]);
    requests = [];
    renderPage();
    expect(await screen.findByText("No erasure requests")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "File erasure request" }));

    const id = await screen.findByRole("textbox", { name: "User ID" });
    fireEvent.change(id, { target: { value: "anil" } });
    fireEvent.click(screen.getByRole("button", { name: "File request" }));
    expect(await screen.findByText(/36 letters, numbers and dashes/)).toBeTruthy();
    expect(changes()).toEqual([]);

    fireEvent.change(id, { target: { value: ANIL } });
    fireEvent.click(screen.getByRole("button", { name: "File request" }));

    await waitFor(() => expect(changes()).toEqual(["POST /v1/gdpr/purge"]));
    expect(vi.mocked(api)).toHaveBeenCalledWith("/v1/gdpr/purge", {
      method: "POST",
      body: { tenant_id: "t-1", user_id: ANIL, reason: "" },
    });
    expect(sensitiveCalls[0]?.actionLabel).toBe("File an erasure request");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("says what happens on which day before anything is filed", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "File erasure request" }));
    const drawer = await screen.findByRole("dialog");
    expect(
      within(drawer).getByText(/Search people in this organisation, deleted people included/),
    ).toBeTruthy();
    expect(
      within(drawer).getByText(/password, authenticator app and recovery codes are deleted/),
    ).toBeTruthy();
    expect(within(drawer).getByText("Kept, so the audit log stays verifiable.")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "File request" }));
    expect(
      await within(drawer).findByText("Choose the person whose data is to be erased."),
    ).toBeTruthy();
    expect(changes()).toEqual([]);
  });
});
