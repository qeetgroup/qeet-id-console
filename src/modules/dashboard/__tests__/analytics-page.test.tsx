// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  useLocation: () => ({ pathname: "/analytics", searchStr: "", hash: "" }),
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

import { api } from "@/platform/api/client";
import { AnalyticsPage } from "../pages";

type Query = { types?: string; q?: string; from?: string; to?: string; bucket?: number };
const today = new Date().toISOString().slice(0, 10);

/** The audit summary: this period has 2 sign-ins a day, the one before 1; failures likewise. */
function summary(query: Query) {
  const before = !!query.to;
  const perDay = before ? 1 : 2;
  const failed = query.types === "auth.sign_in_failed";
  return {
    total: perDay,
    unique_actors: failed ? 0 : before ? 4 : 5,
    series: [{ at: `${before ? query.from?.slice(0, 10) : today}T00:00:00Z`, count: perDay }],
  };
}

beforeEach(() => {
  granted.except = new Set();
  vi.mocked(api).mockImplementation(async (path: string, options?: { query?: Query }) => {
    if (path === "/v1/activity/summary") return summary(options?.query ?? {});
    throw new Error(`Unexpected request ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(range: "7d" | "30d" | "90d" = "30d") {
  const onRangeChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AnalyticsPage range={range} onRangeChange={onRangeChange} />
    </QueryClientProvider>,
  );
  return { onRangeChange };
}

const summaries = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([path]) => path === "/v1/activity/summary")
    .map(([, options]) => (options as { query: Query }).query);

describe("Analytics", () => {
  it("counts sign-ins without organisation switches, people from every sign-in, by UTC day", async () => {
    renderPage("7d");
    await screen.findByText("People who signed in");
    const queries = summaries();
    expect(queries).toHaveLength(6);
    const signIns = queries.filter((q) => q.q);
    expect(signIns.every((q) => q.types === "auth.login_succeeded")).toBe(true);
    expect(signIns[0]?.q).toBe("-tenant_switch -tenant_create -invite_accept");
    expect(queries.filter((q) => q.types === "auth.sign_in_failed")).toHaveLength(2);
    expect(queries.every((q) => q.bucket === 86_400)).toBe(true);
    // The range is open-ended; the period before ends where it starts.
    const current = queries.find((q) => !q.to);
    const before = queries.find((q) => q.to);
    expect(Date.parse(before?.to ?? "") + 1).toBe(Date.parse(current?.from ?? ""));
  });

  it("totals the range against the period before it", async () => {
    renderPage("7d");
    const band = (await screen.findByText("People who signed in")).closest("dl") as HTMLElement;
    const cell = (label: string) => within(band).getByText(label).closest("div") as HTMLElement;
    await waitFor(() => expect(within(cell("Sign-ins")).getByText("2")).toBeTruthy());
    expect(within(cell("Sign-ins")).getByText("Up 100% on the 7 days before")).toBeTruthy();
    expect(within(cell("People who signed in")).getByText("5")).toBeTruthy();
    expect(
      within(cell("People who signed in")).getByText("Up 25% on the 7 days before"),
    ).toBeTruthy();
    // More failures is flagged.
    const failed = within(cell("Failed sign-ins")).getByText("Up 100% on the 7 days before");
    expect(failed.className).toContain("is-warning");
  });

  it("changes the range from the header", async () => {
    const { onRangeChange } = renderPage("30d");
    fireEvent.click(await screen.findByRole("button", { name: "90 days" }));
    expect(onRangeChange).toHaveBeenCalledWith("90d");
  });

  it("averages the day of the week only over a range of weeks", async () => {
    renderPage("30d");
    expect(await screen.findByRole("heading", { name: "By day of the week" })).toBeTruthy();
    cleanup();
    renderPage("7d");
    await screen.findByRole("heading", { name: "Failed sign-ins by day" });
    expect(screen.queryByRole("heading", { name: "By day of the week" })).toBeNull();
  });

  it("explains, and asks nothing, without access to audit events", async () => {
    granted.except = new Set(["audit.read"]);
    renderPage();
    expect(await screen.findByText("These trends come from the audit log")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });
});
