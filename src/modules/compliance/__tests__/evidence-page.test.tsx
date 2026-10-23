// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/compliance/soc2" }),
}));

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import * as dataExport from "@/shared/utils/data-export";
import { ComplianceEvidencePage } from "../evidence-page";

type Control = {
  id: string;
  name: string;
  category: string;
  criteria: string;
  status: "pass" | "fail" | "na";
  detail: string;
};

type Run = {
  id: string;
  tenant_id: string;
  framework: string;
  generated_at: string;
  pass_count: number;
  fail_count: number;
  na_count: number;
  controls?: Control[];
};

function control(criteria: string, status: Control["status"], name = `Control ${criteria}`) {
  return {
    id: `ctl-${criteria}`,
    name,
    category: "Logical access",
    criteria,
    status,
    detail: `Evidence for ${criteria}`,
  } satisfies Control;
}

const NEWEST: Run = {
  id: "run-new",
  tenant_id: "tenant-a",
  framework: "soc2",
  generated_at: "2026-10-20T10:00:00Z",
  pass_count: 2,
  fail_count: 1,
  na_count: 1,
  controls: [
    control("CC6.1", "pass", "MFA enforced"),
    control("CC6.2", "pass"),
    control("CC7.2", "fail", "Audit log monitored"),
    control("CC9.9", "na", "Vendor review"),
  ],
};

const OLDER: Run = {
  id: "run-old",
  tenant_id: "tenant-a",
  framework: "soc2",
  generated_at: "2026-09-01T10:00:00Z",
  pass_count: 1,
  fail_count: 0,
  na_count: 0,
  controls: [control("CC1.1", "pass", "Code of conduct")],
};

const GENERATED: Run = {
  id: "run-generated",
  tenant_id: "tenant-a",
  framework: "soc2",
  generated_at: "2026-10-23T10:00:00Z",
  pass_count: 1,
  fail_count: 0,
  na_count: 0,
  controls: [control("CC8.1", "pass", "Change management")],
};

/** Returns the run without its controls, as the list endpoint sends it. */
function summary({ controls: _controls, ...run }: Run): Run {
  return run;
}

type Response = unknown | Error | (() => Promise<unknown>);

/** Mocks api() with responses keyed by "METHOD path"; any other request throws. */
function serve(routes: Record<string, Response>) {
  vi.mocked(api).mockImplementation(async (path, opts) => {
    const route = routes[`${opts?.method ?? "GET"} ${path}`];
    if (route === undefined) throw new Error(`Unexpected request ${opts?.method ?? "GET"} ${path}`);
    if (route instanceof Error) throw route;
    if (typeof route === "function") return route();
    return route;
  });
}

const LIST = "GET /v1/tenants/tenant-a/compliance/soc2/evidence";
const GENERATE = "POST /v1/tenants/tenant-a/compliance/soc2/evidence";
const detail = (id: string) => `GET /v1/tenants/tenant-a/compliance/evidence/${id}`;

function renderPage(framework: "soc2" | "iso27001" = "soc2") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ComplianceEvidencePage framework={framework} />
    </QueryClientProvider>,
  );
}

/** Returns the selectable history rows, newest first. */
function historyRows() {
  return screen.getAllByRole("row").filter((row) => row.hasAttribute("aria-selected"));
}

/** Returns a stat card's label and value; history column headers reuse the labels. */
function stat(label: string): string {
  const [heading] = screen.getAllByText(label).filter((el) => el.closest("table") === null);
  const card = heading?.parentElement?.parentElement;
  assert(card, `expected a "${label}" stat card`);
  return card.textContent ?? "";
}

beforeEach(() => {
  context.tenantId = "tenant-a";
  vi.mocked(api).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ComplianceEvidencePage", () => {
  it("lists the framework's evidence runs and opens the newest one", async () => {
    serve({
      [LIST]: { items: [summary(NEWEST), summary(OLDER)] },
      [detail("run-new")]: NEWEST,
    });
    renderPage();

    expect(screen.getByRole("heading", { name: "SOC 2" })).toBeTruthy();
    expect(await screen.findByText("MFA enforced")).toBeTruthy();

    const passing = screen.getByText("MFA enforced").closest("tr");
    assert(passing, "expected the MFA control row");
    expect(passing.textContent).toBe("CC6.1MFA enforcedLogical accesspassEvidence for CC6.1");
    expect(screen.getByText("Audit log monitored").closest("tr")?.textContent).toContain("fail");
    expect(screen.getByText("Vendor review").closest("tr")?.textContent).toContain("n/a");

    expect(stat("Controls passing")).toBe("Controls passing2/4");
    expect(stat("Failing")).toBe("Failing1");
    expect(stat("Not determinable")).toBe("Not determinable1");
    expect(screen.getByText("4 controls checked in this run")).toBeTruthy();
    expect(screen.getByText("2 runs — select a row to load its controls above.")).toBeTruthy();

    const [newest, older] = historyRows();
    expect(newest?.getAttribute("aria-selected")).toBe("true");
    expect(older?.getAttribute("aria-selected")).toBe("false");
  });

  it("loads another run's controls when its history row is picked, by click or keyboard", async () => {
    serve({
      [LIST]: { items: [summary(NEWEST), summary(OLDER)] },
      [detail("run-new")]: NEWEST,
      [detail("run-old")]: OLDER,
    });
    renderPage();
    await screen.findByText("MFA enforced");

    const [newest, older] = historyRows();
    assert(newest && older, "expected two history rows");
    fireEvent.click(older);

    expect(await screen.findByText("Code of conduct")).toBeTruthy();
    expect(screen.queryByText("MFA enforced")).toBeNull();
    expect(stat("Controls passing")).toBe("Controls passing1/1");
    expect(older.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(newest, { key: "Enter" });
    expect(await screen.findByText("MFA enforced")).toBeTruthy();
    expect(newest.getAttribute("aria-selected")).toBe("true");
  });

  it("generates evidence and shows the new run's controls from the response straight away", async () => {
    let finishGenerating: (run: Run) => void = () => {};
    let generated = false;
    serve({
      [LIST]: () =>
        Promise.resolve({
          items: generated ? [summary(GENERATED), summary(OLDER)] : [summary(OLDER)],
        }),
      [detail("run-old")]: OLDER,
      // The detail read for the new run never answers: what shows must come from the POST.
      [detail("run-generated")]: () => new Promise(() => {}),
      [GENERATE]: () =>
        new Promise<Run>((resolve) => {
          finishGenerating = (run) => {
            generated = true;
            resolve(run);
          };
        }),
    });
    renderPage();
    await screen.findByText("Code of conduct");

    fireEvent.click(screen.getByRole("button", { name: "Generate evidence" }));
    const pending = await screen.findByRole("button", { name: "Generating..." });
    expect((pending as HTMLButtonElement).disabled).toBe(true);

    finishGenerating(GENERATED);

    expect(await screen.findByText("Change management")).toBeTruthy();
    await waitFor(() => expect(historyRows()).toHaveLength(2));
    expect(historyRows()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/compliance/soc2/evidence", {
      method: "POST",
    });
  });

  it("invites a first run when there is no evidence yet", async () => {
    serve({ [LIST]: { items: [] }, [GENERATE]: GENERATED, [detail("run-generated")]: GENERATED });
    renderPage();

    expect(await screen.findByText("No evidence runs yet")).toBeTruthy();
    expect(screen.queryByText("Controls")).toBeNull();

    const buttons = screen.getAllByRole("button", { name: "Generate evidence" });
    expect(buttons).toHaveLength(2);
    const [, emptyStateButton] = buttons;
    assert(emptyStateButton, "expected the empty-state generate button");
    fireEvent.click(emptyStateButton);

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/compliance/soc2/evidence", {
        method: "POST",
      }),
    );
  });

  it("shows safe copy, never the backend message, when the run list fails", async () => {
    serve({
      [LIST]: new ApiError(500, "internal", 'pq: relation "evidence_runs" does not exist'),
    });
    renderPage();

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/evidence_runs/)).toBeNull();
    expect(screen.queryByText("No evidence runs yet")).toBeNull();
  });

  it("shows safe copy, never the backend message, when a run's controls fail to load", async () => {
    serve({
      [LIST]: { items: [summary(NEWEST)] },
      [detail("run-new")]: new ApiError(403, "authz.denied", "role compliance_admin missing"),
    });
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("You don't have access to do that.");
    expect(screen.queryByText(/compliance_admin/)).toBeNull();
  });

  it("downloads the selected run, controls included, as JSON", async () => {
    const exportSpy = vi.spyOn(dataExport, "exportToJson").mockImplementation(() => {});
    serve({ [LIST]: { items: [summary(NEWEST)] }, [detail("run-new")]: NEWEST });
    renderPage();
    await screen.findByText("MFA enforced");

    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect(exportSpy).toHaveBeenCalledWith("evidence-soc2", [NEWEST]);
  });

  it("reads the ISO 27001 runs for the ISO page", async () => {
    vi.mocked(api).mockResolvedValue({ items: [] });
    renderPage("iso27001");

    expect(screen.getByRole("heading", { name: "ISO 27001" })).toBeTruthy();
    await screen.findByText("No evidence runs yet");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/compliance/iso27001/evidence");
  });

  it("asks for nothing and cannot generate before a tenant is selected", async () => {
    context.tenantId = null;
    vi.mocked(api).mockResolvedValue({ items: [] });
    renderPage();

    const buttons = await screen.findAllByRole("button", { name: "Generate evidence" });
    for (const button of buttons) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(api).not.toHaveBeenCalled();
  });

  it("does not offer a download until a run has loaded", async () => {
    serve({
      [LIST]: { items: [summary(NEWEST)] },
      [detail("run-new")]: () => new Promise(() => {}),
    });
    renderPage();

    const download = await screen.findByRole("button", { name: "Download JSON" });
    expect((download as HTMLButtonElement).disabled).toBe(true);
    // The stat cards hold placeholders rather than numbers until the run arrives.
    expect(stat("Controls passing")).toBe("Controls passing");
  });
});
