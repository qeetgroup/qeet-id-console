// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const access = vi.hoisted(() => ({ can: (_capability: string): boolean => true }));

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useOrganizationId: () => "t1",
  useUserId: () => "u-me",
  useSessionId: () => "s1",
  useMe: () => ({ data: { id: "u-me", email: "priya@qeet.in", display_name: "Priya Nair" } }),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    mode: "full",
    can: (capability: string) => access.can(capability),
    canAll: () => true,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/developer/infrastructure", searchStr: "", hash: "" }),
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
import type { ServiceHealth } from "../api/service-health";
import { InfrastructurePage } from "../components/infrastructure-page";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const HEALTH_PATH = "/v1/organizations/t1/service-health";

const operational = (): ServiceHealth => ({
  status: "operational",
  checked_at: ago(2 * MINUTE),
  components: [
    { name: "api", state: "operational" },
    { name: "sign_in", state: "operational" },
    { name: "email", state: "operational" },
    { name: "webhooks", state: "operational" },
    { name: "directory", state: "operational" },
  ],
  incidents: [],
});

type Incident = ServiceHealth["incidents"][number];

const RESOLVED_EMAIL: Incident = {
  id: "5d1f6b1e-0000-4000-8000-000000000001",
  component: "email",
  impact: "degraded",
  title: "Email delays",
  started_at: ago(3 * DAY),
  resolved_at: ago(2 * DAY),
};
const OPEN_DIRECTORY: Incident = {
  id: "5d1f6b1e-0000-4000-8000-000000000002",
  component: "directory",
  impact: "outage",
  title: "Directory sync is down",
  detail: "Directory connections are failing while we restore the connectors.",
  started_at: ago(HOUR),
  resolved_at: null,
};

const troubled = (): ServiceHealth => ({
  status: "outage",
  checked_at: ago(2 * MINUTE),
  components: [
    { name: "api", state: "operational" },
    { name: "sign_in", state: "operational" },
    {
      name: "email",
      state: "degraded",
      reason: "email.failing",
      figures: { sent_last_hour: 40, failed_last_hour: 12 },
    },
    { name: "webhooks", state: "not_configured" },
    { name: "directory", state: "outage", reason: "incident" },
  ],
  incidents: [RESOLVED_EMAIL, OPEN_DIRECTORY],
});

let calls: string[];
let health: () => Promise<ServiceHealth>;

beforeEach(() => {
  calls = [];
  access.can = () => true;
  health = async () => operational();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path: string) => {
    calls.push(path);
    if (path === HEALTH_PATH) return health();
    if (path === "/v1/oidc/signing-keys") return { keys: [] };
    throw new Error(`Unexpected GET ${path}`);
  });
});
afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InfrastructurePage />
    </QueryClientProvider>,
  );
}

const healthSection = async () =>
  within(
    (await screen.findByRole("heading", { name: "Service health", level: 2 })).closest(
      "section",
    ) as HTMLElement,
  );

describe("Infrastructure › Service health", () => {
  it("shows each part's state and when it was checked", async () => {
    health = async () => troubled();
    renderPage();
    const section = await healthSection();
    await section.findByText("Directory sync");
    const rows = section.getAllByText("Checked", { exact: false });
    expect(rows).toHaveLength(5);
    expect(section.getAllByText("2 minutes ago")).toHaveLength(5);

    const row = (label: string) => within(section.getByText(label).closest("div") as HTMLElement);
    expect(row("API").getByText("Operational")).toBeTruthy();
    expect(row("Sign-in").getByText("Operational")).toBeTruthy();
    expect(row("Email").getByText("Degraded")).toBeTruthy();
    expect(
      row("Email").getByText(/refused at least a quarter of your organization’s emails/),
    ).toBeTruthy();
    expect(row("Webhooks").getByText("Not in use")).toBeTruthy();
    expect(row("Directory sync").getByText("Outage")).toBeTruthy();
    expect(row("Directory sync").getByText("An incident that affects it is open.")).toBeTruthy();
    expect(calls).toContain(HEALTH_PATH);
  });

  it("names the worst state beside the heading", async () => {
    health = async () => troubled();
    renderPage();
    const heading = await screen.findByRole("heading", { name: "Service health", level: 2 });
    const head = within(heading.parentElement as HTMLElement);
    expect(await head.findByText("Outage")).toBeTruthy();
  });

  it("puts an open incident first, and the resolved ones under their own heading", async () => {
    health = async () => troubled();
    renderPage();
    const section = await healthSection();
    expect(await section.findByText("Directory sync is down")).toBeTruthy();
    expect(
      section.getByText("Directory connections are failing while we restore the connectors."),
    ).toBeTruthy();
    expect(section.getByText(/Affects Directory sync\. Started/)).toBeTruthy();
    expect(section.getByText("1 hour ago")).toBeTruthy();

    const resolved = section.getByRole("heading", { name: "Resolved in the last 14 days" });
    expect(resolved).toBeTruthy();
    const list = within(section.getByRole("list"));
    expect(list.getByText("Email delays")).toBeTruthy();
    expect(list.getByText(/Affected Email\. Resolved/)).toBeTruthy();
    expect(list.getByText("2 days ago")).toBeTruthy();
    expect(section.queryByText("No open incidents.")).toBeNull();
  });

  it("says so when no incident was posted", async () => {
    renderPage();
    const section = await healthSection();
    expect(await section.findByText("No incidents")).toBeTruthy();
    expect(
      section.getByText("The Qeet ID team hasn’t posted an incident in the last 14 days."),
    ).toBeTruthy();
    expect(section.getAllByText("Operational")).toHaveLength(6); // five parts and the overall state
    expect(section.queryByRole("heading", { name: "Open incidents" })).toBeNull();
  });

  it("says nothing is open when only resolved incidents remain", async () => {
    health = async () => ({ ...operational(), incidents: [RESOLVED_EMAIL] });
    renderPage();
    const section = await healthSection();
    expect(await section.findByText("No open incidents.")).toBeTruthy();
    expect(section.getByText("Email delays")).toBeTruthy();
  });

  it("shows a failure without the server's words, and reads again on Try again", async () => {
    health = async () => {
      throw new Error("pq: relation internal_health does not exist");
    };
    renderPage();
    const section = await healthSection();
    expect(await section.findByText("Couldn't load this")).toBeTruthy();
    expect(screen.queryByText(/internal_health/)).toBeNull();

    health = async () => operational();
    fireEvent.click(section.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(section.getByText("No incidents")).toBeTruthy());
    expect(calls.filter((path) => path === HEALTH_PATH)).toHaveLength(2);
  });

  it("reads nothing, and shows nothing, without organization.read", async () => {
    access.can = (capability) => capability !== "organization.read";
    renderPage();
    await screen.findByRole("heading", { name: "Endpoints" });
    expect(screen.queryByRole("heading", { name: "Service health" })).toBeNull();
    expect(calls).not.toContain(HEALTH_PATH);
  });

  it("no longer tells people Qeet ID reports no health, or to run it themselves", async () => {
    renderPage();
    await healthSection();
    await screen.findByText("No incidents");
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/readyz|metrics|monitoring|yourself|reports no health|Not reported/i);
  });
});
