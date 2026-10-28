// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
const caps = vi.hoisted(() => ({ denied: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: (c: string) => !caps.denied.has(c) }),
}));
const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, string | undefined>,
}));
// The page reads its param and address from its own route; links render as plain anchors.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ userId: "u-1" }),
    useSearch: () => router.search,
    useNavigate: () => router.navigate,
  }),
  Link: ({
    children,
    to,
    params,
    search,
    replace: _replace,
    ...props
  }: React.ComponentProps<"a"> & {
    to: string;
    params?: { userId: string };
    search?: Record<string, string | undefined>;
    replace?: boolean;
  }) => {
    const query = new URLSearchParams(
      Object.entries(search ?? {}).filter((e): e is [string, string] => !!e[1]),
    ).toString();
    const path = to.replace("$userId", params?.userId ?? "");
    return (
      <a {...props} href={query ? `${path}?${query}` : path}>
        {children}
      </a>
    );
  },
}));

import { api } from "@/platform/api/client";
import { Route } from "./$userId_.timeline";

const TimelineRoute = Route.options.component as () => React.JSX.Element;
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).toISOString();
const ANANYA = { id: "u-1", name: "Ananya Iyer", type: "user" };

const passkey = {
  id: "e-passkey",
  type: "auth.login_succeeded",
  category: "authentication",
  severity: "success",
  title: "Auth Login_succeeded",
  at: at(28, 10),
  actor: ANANYA,
  ip: "203.0.113.10",
  browser: "Edge",
  metadata: { method: "passkey" },
};
const twoStep = {
  ...passkey,
  id: "e-mfa",
  at: at(28, 9),
  ip: "203.0.113.46",
  browser: "Chrome",
  metadata: { method: "password_mfa" },
};
const role = {
  id: "e-role",
  type: "role.assigned",
  category: "authorization",
  severity: "success",
  title: "Role Assigned",
  at: at(27, 15),
  actor: { id: "u-2", name: "Priya Nair", type: "user" },
  target: { type: "user", id: "u-1" },
  metadata: { role_id: "r-1" },
};
const failed = {
  id: "e-failed",
  type: "auth.sign_in_failed",
  category: "authentication",
  severity: "error",
  title: "Auth Sign_in_failed",
  at: at(27, 8),
  actor: ANANYA,
  ip: "203.0.113.10",
  metadata: { method: "password", reason: "wrong_password" },
};
const sso = { ...passkey, id: "e-sso", at: at(20, 11), metadata: { method: "saml" } };

const summary = {
  total: 5,
  unique_actors: 2,
  security_alerts: 0,
  by_severity: {},
  by_category: {
    authentication: 4,
    authorization: 1,
    directory: 0,
    security: 0,
    developer: 0,
    system: 0,
  },
  by_outcome: { success: 4, warning: 0, failed: 1, info: 0 },
  series: [
    { at: at(28, 9), count: 2, success: 2, warning: 0, failed: 0, info: 0, critical: 0 },
    { at: at(27, 8), count: 2, success: 1, warning: 0, failed: 1, info: 0, critical: 0 },
    { at: at(20, 11), count: 1, success: 1, warning: 0, failed: 0, info: 0, critical: 0 },
  ],
  bucket_seconds: 900,
  window: { from: at(1, 0), to: at(28, 12) },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 28, 12, 0));
  caps.denied.clear();
  router.search = {};
  router.navigate.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const query = (options?.query ?? {}) as Record<string, unknown>;
    if (path === "/v1/users/u-1")
      return {
        id: "u-1",
        tenant_id: "t-1",
        email: "ananya@qeet.in",
        display_name: "Ananya Iyer",
        status: "active",
      };
    if (path === "/v1/tenants/t-1/roles")
      return { items: [{ id: "r-1", name: "editor", description: "", is_system: false }] };
    if (path === "/v1/activity/summary") return summary;
    if (path === "/v1/activity" && query.types) return { events: [passkey, twoStep, failed, sso] };
    if (path === "/v1/activity" && query.severity === "error") return { events: [failed] };
    if (path === "/v1/activity" && query.cursor === "c2") return { events: [sso] };
    if (path === "/v1/activity")
      return { events: [passkey, twoStep, role, failed], next_cursor: "c2" };
    throw new Error(`Unexpected request ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TimelineRoute />
    </QueryClientProvider>,
  );
}

const reads = () =>
  vi.mocked(api).mock.calls.map(([path, options]) => ({
    path,
    ...((options?.query ?? {}) as Record<string, unknown>),
  }));

describe("a person's timeline", () => {
  it("sums the period up before the events: sign-ins and how, what failed, where from", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Timeline", level: 1 })).toBeTruthy();
    const back = await screen.findByRole("link", { name: /Ananya Iyer/ });
    expect(back.getAttribute("href")).toBe("/users/u-1");
    expect(await screen.findByText("2 of 3 with a second step or a passkey")).toBeTruthy();
    expect(screen.getByText("Mostly with a passkey")).toBeTruthy();
    expect(screen.getByText("1 wrong password")).toBeTruthy();
    const addresses = screen.getByText("Addresses").closest("div") as HTMLElement;
    expect(within(addresses).getByText("2")).toBeTruthy();
    expect(screen.getByText("With Edge and Chrome")).toBeTruthy();
    expect(screen.getByText("Most from 203.0.113.10 (3)")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Show the failures" }).getAttribute("href")).toBe(
      "/users/u-1/timeline?result=failed",
    );
    // The browser's own date order ("27 October" or "October 27").
    expect(
      screen.getByRole("img", {
        name: /most on Tuesday,? (27 October|October 27), 2\. Failures on 1 day\./,
      }),
    ).toBeTruthy();
    // The summary and the sign-ins cover the period: the last 30 days, from local midnight.
    const from = new Date(2026, 8, 29).toISOString();
    expect(reads()).toContainEqual({
      path: "/v1/activity/summary",
      subject: "u-1",
      from,
      bucket: 900,
    });
  });

  it("lists the events by day, each with who and where, linking to its record in Activity", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "Signed in with a passkey" });
    const href = new URL(link.getAttribute("href") ?? "", "http://x");
    expect(href.pathname).toBe("/activity");
    expect(href.searchParams.get("range")).toBe("custom");
    expect(href.searchParams.get("event")).toBe("e-passkey");
    expect(href.searchParams.get("from")).toBe(new Date(2026, 9, 28).toISOString());
    const list = screen.getByRole("list", { name: "Events, newest first" });
    const today = within(list).getByText("Today").closest("li") as HTMLElement;
    expect(within(today).getByText("Signed in with a password and a second step")).toBeTruthy();
    const yesterday = within(list).getByText("Yesterday").closest("li") as HTMLElement;
    expect(within(yesterday).getByText("Sign-in failed: wrong password")).toBeTruthy();
    // Someone else's change says who made it; the role is named.
    const given = await within(yesterday).findByText("Given the editor role");
    expect(given.closest("li")?.textContent).toContain("Priya Nair");
    expect(link.closest("li")?.textContent).toContain("Edge");
    expect(link.closest("li")?.textContent).toContain("203.0.113.10");
  });

  it("shows older events a page at a time", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Show older events" }));
    expect(await screen.findByRole("link", { name: "Signed in with single sign-on" })).toBeTruthy();
    expect(reads()).toContainEqual(expect.objectContaining({ path: "/v1/activity", cursor: "c2" }));
    expect(
      await screen.findByText(/That's everything since (29 September|September 29)/),
    ).toBeTruthy();
  });

  it("narrows the list to the failures from the address, and puts a choice there", async () => {
    router.search = { result: "failed" };
    renderPage();
    expect(
      await screen.findByRole("link", { name: "Sign-in failed: wrong password" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Signed in with a passkey" })).toBeNull();
    expect(reads()).toContainEqual(
      expect.objectContaining({ path: "/v1/activity", severity: "error", subject: "u-1" }),
    );
    expect(screen.queryByRole("link", { name: "Show the failures" })).toBeNull();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Period" }), { button: 0 });
    const option = await screen.findByRole("option", { name: "Last 7 days" });
    fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
    fireEvent.click(option);
    await waitFor(() => expect(router.navigate).toHaveBeenCalled());
    const [{ search }] = router.navigate.mock.calls.at(-1) as [{ search: () => object }];
    expect(search()).toEqual({ result: "failed", period: "7d" });
  });

  it("says so when the role can't read the audit log, and reads none of it", async () => {
    caps.denied.add("audit.read");
    renderPage();
    expect(await screen.findByText("Your role can't see activity")).toBeTruthy();
    expect(reads().some((r) => r.path.startsWith("/v1/activity"))).toBe(false);
  });
});
