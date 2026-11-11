// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, assert, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "tenant-a",
  useUserId: () => "u-me",
}));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/security/compliance/soc2", searchStr: "", hash: "" }),
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

import { formatDate } from "@qeetrix/react";

import { formatLocale } from "@/i18n";
import { ApiError, api } from "@/platform/api/client";
import * as dataExport from "@/shared/utils/data-export";
import type { ControlResult, EvidenceRun } from "../api/evidence";
import { EvidencePage } from "../pages";

const control = (
  id: string,
  status: ControlResult["status"],
  name: string,
  detail = `Found for ${id}`,
): ControlResult => ({
  id,
  name,
  category: "Logical and Physical Access Controls",
  criteria: id.split("-")[0] ?? id,
  status,
  detail,
});

function run(id: string, at: string, controls: ControlResult[], by: string | null = "u-shalini") {
  const count = (s: ControlResult["status"]) => controls.filter((c) => c.status === s).length;
  return {
    id,
    tenant_id: "tenant-a",
    framework: "soc2",
    generated_at: at,
    generated_by: by,
    pass_count: count("pass"),
    fail_count: count("fail"),
    na_count: count("na"),
    controls,
  } satisfies EvidenceRun;
}

// Newest first. MFA has failed in every run; the vault had no evidence only in the newest.
const NEWEST = run("run-3", "2026-10-07T03:38:00Z", [
  control("CC6.1-MFA", "fail", "Multi-Factor Authentication Enforcement", "MFA is not enforced"),
  control("CC6.1-PWD-LEN", "pass", "Password Minimum Length"),
  control("CC6.7-SECRETS", "na", "Secrets Encryption at Rest"),
  control("CC7.2-CHAIN", "pass", "Audit Log Tamper-Evidence"),
]);
const MIDDLE = run("run-2", "2026-09-07T03:38:00Z", [
  control("CC6.1-MFA", "fail", "Multi-Factor Authentication Enforcement"),
  control("CC6.1-PWD-LEN", "fail", "Password Minimum Length"),
  control("CC6.7-SECRETS", "pass", "Secrets Encryption at Rest"),
  control("CC7.2-CHAIN", "pass", "Audit Log Tamper-Evidence"),
]);
const OLDEST = run(
  "run-1",
  "2025-09-12T13:16:00Z",
  [
    control("CC6.1-MFA", "fail", "Multi-Factor Authentication Enforcement"),
    control("CC6.1-PWD-LEN", "fail", "Password Minimum Length"),
    control("CC6.7-SECRETS", "pass", "Secrets Encryption at Rest"),
    control("CC7.2-CHAIN", "pass", "Audit Log Tamper-Evidence"),
  ],
  null,
);
const RUNS = [NEWEST, MIDDLE, OLDEST];
const day = (run: EvidenceRun) => formatDate(run.generated_at, formatLocale());
const summary = ({ controls: _controls, ...rest }: EvidenceRun) => rest;

const SHALINI = {
  id: "u-shalini",
  tenant_id: "tenant-a",
  email: "shalini.goyal@qeet.in",
  display_name: "Shalini Goyal",
  status: "active",
  created_at: "2025-01-01T00:00:00Z",
};

const LIST = "GET /v1/tenants/tenant-a/compliance/soc2/evidence";
const GENERATE = "POST /v1/tenants/tenant-a/compliance/soc2/evidence";
const detail = (id: string) => `GET /v1/tenants/tenant-a/compliance/evidence/${id}`;
const EVERY_RUN = {
  [LIST]: { items: RUNS.map(summary) },
  [detail("run-3")]: NEWEST,
  [detail("run-2")]: MIDDLE,
  [detail("run-1")]: OLDEST,
};

type Answer = unknown | Error | (() => Promise<unknown>);

/** Answers by "METHOD path"; the people lists answer for every test; anything else throws. */
function serve(routes: Record<string, Answer>) {
  vi.mocked(api).mockImplementation(async (path: string, opts?: { method?: string }) => {
    const key = `${opts?.method ?? "GET"} ${path}`;
    if (path === "/v1/users") return { items: [SHALINI] };
    if (path === "/v1/users/deleted") return { items: [] };
    const answer = routes[key];
    if (answer === undefined) throw new Error(`Unexpected request ${key}`);
    if (answer instanceof Error) throw answer;
    return typeof answer === "function" ? (answer as () => Promise<unknown>)() : answer;
  });
}

function renderPage(props: Partial<ComponentProps<typeof EvidencePage>> = {}) {
  const onRunChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EvidencePage framework="soc2" onRunChange={onRunChange} {...props} />
    </QueryClientProvider>,
  );
  return { onRunChange };
}

async function section(name: string): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name });
  const found = heading.closest("section");
  assert(found, `expected the "${name}" section`);
  return found;
}

// jsdom has no Web Animations; the tables' ScrollArea asks for them after a scroll.
beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
});

beforeEach(() => {
  granted.except = new Set();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(api).mockReset();
});

describe("Compliance › SOC 2", () => {
  it("opens on the newest run: its result, who ran it and its scope, never as a certification", async () => {
    serve(EVERY_RUN);
    renderPage();

    expect(await screen.findByText("1 failing")).toBeTruthy();
    expect(screen.getByText("2 of 4 pass · 1 no evidence")).toBeTruthy();
    expect((await screen.findAllByText("Shalini Goyal")).length).toBeGreaterThan(0);
    expect(screen.getByText("4 checks")).toBeTruthy();
    expect(screen.getByText(/not an audit, a report or a certification/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Compliance" })).toBeTruthy();
  });

  it("lists what's missing, failing first, since when, and where each is fixed", async () => {
    serve(EVERY_RUN);
    renderPage();

    const missing = await section("What's missing");
    const names = within(missing)
      .getAllByRole("listitem")
      .map((li) => li.querySelector("strong")?.textContent);
    expect(names).toEqual([
      "Multi-Factor Authentication Enforcement",
      "Secrets Encryption at Rest",
    ]);
    expect(
      await within(missing).findByText(`Failing in every run since ${day(OLDEST)} (3 runs)`),
    ).toBeTruthy();
    expect(
      within(missing).getByText(/No evidence since this run; passed in the run before/),
    ).toBeTruthy();
    // MFA is the security policy's: the link says where, and what it fixes.
    const fix = within(missing).getByRole("link", {
      name: "Security settings, to fix Multi-Factor Authentication Enforcement",
    });
    expect(fix.getAttribute("href")).toBe("/settings/organization/security-policy");
  });

  it("filters the checks by result", async () => {
    serve(EVERY_RUN);
    renderPage();
    const table = await screen.findByRole("table", { name: "SOC 2 checks" });
    expect(within(table).getAllByRole("row")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /^Fail/ }));

    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(2));
    expect(within(table).getByText("MFA is not enforced")).toBeTruthy();
  });

  it("opens an older run from the list, and from it goes back to the latest", async () => {
    serve(EVERY_RUN);
    const first = renderPage();
    const runs = await screen.findByRole("table", { name: "SOC 2 evidence runs" });
    expect(within(runs).getByText("Viewing")).toBeTruthy();
    fireEvent.click(within(runs).getByRole("button", { name: new RegExp(`^${day(MIDDLE)}`) }));
    expect(first.onRunChange).toHaveBeenCalledWith("run-2");
    cleanup();

    const older = renderPage({ runId: "run-1" });
    expect(
      await screen.findByText(
        `You're viewing the run of ${day(OLDEST)}. The latest is from ${day(NEWEST)}.`,
      ),
    ).toBeTruthy();
    const missing = await section("What was missing");
    expect(
      await within(missing).findByText(`Still failing in the latest run, ${day(NEWEST)}`),
    ).toBeTruthy();
    expect(within(missing).getByText(`Passes in the latest run, ${day(NEWEST)}`)).toBeTruthy();
    expect(screen.getAllByText("Qeet ID").length).toBeGreaterThan(0); // generated by the system
    fireEvent.click(screen.getByRole("button", { name: "Show the latest" }));
    expect(older.onRunChange).toHaveBeenCalledWith(undefined);
  });

  it("generates evidence, then shows the latest run", async () => {
    serve({ ...EVERY_RUN, [GENERATE]: NEWEST });
    const { onRunChange } = renderPage({ runId: "run-2" });
    fireEvent.click(await screen.findByRole("button", { name: "Generate evidence" }));

    await waitFor(() => expect(onRunChange).toHaveBeenCalledWith(undefined));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/compliance/soc2/evidence", {
      method: "POST",
    });
  });

  it("downloads the run on show, its checks included, as JSON", async () => {
    const exportSpy = vi.spyOn(dataExport, "exportToJson").mockImplementation(() => {});
    serve(EVERY_RUN);
    renderPage();
    const controls = await section("Controls");

    fireEvent.click(within(controls).getByRole("button", { name: "Download evidence" }));

    expect(exportSpy).toHaveBeenCalledWith("evidence-soc2-2026-10-07", [NEWEST]);
  });

  it("invites a first run when there is no evidence yet", async () => {
    serve({ [LIST]: { items: [] }, [GENERATE]: NEWEST });
    renderPage();

    expect(await screen.findByText("No SOC 2 evidence yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Generate evidence" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/compliance/soc2/evidence", {
        method: "POST",
      }),
    );
  });

  it("offers no Generate without audit.write, and names no one without user.read", async () => {
    granted.except = new Set(["audit.write", "user.read"]);
    serve(EVERY_RUN);
    renderPage();

    expect((await screen.findAllByText("Someone in this organisation")).length).toBe(3);
    expect(screen.queryByRole("button", { name: "Generate evidence" })).toBeNull();
    expect(vi.mocked(api).mock.calls.map(([path]) => path)).not.toContain("/v1/users");
  });

  it("shows safe copy, never the server's message, when the runs can't be read", async () => {
    serve({
      [LIST]: new ApiError(500, "internal", 'pq: relation "evidence_runs" does not exist'),
    });
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't load this");
    expect(screen.queryByText(/evidence_runs/)).toBeNull();
  });
});
