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
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t-1",
  useUserId: () => "u-me",
  useSessionId: () => "s-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/security/log-streaming", searchStr: "", hash: "" }),
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
const sensitiveCalls = vi.hoisted(
  () => [] as { actionLabel?: string; confirm?: { description?: string } }[],
);
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { LogStreamsPage } from "../components/monitoring/log-streams-page";

const SINK = {
  id: "sink-1",
  type: "http",
  endpoint: "https://ingest.logs.example.com/v1/qeet-id",
  enabled: true,
  last_forwarded_at: "2026-10-26T10:00:00Z",
  last_error: 'Post "https://ingest.logs.example.com/v1/qeet-id": no such host',
  created_at: "2026-10-01T10:00:00Z",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/log-sinks" && method === "GET") return { items: [SINK] };
    if (path === "/v1/tenants/t-1/log-sinks" && method === "POST") return { ...SINK, id: "sink-2" };
    if (path === "/v1/tenants/t-1/log-sinks/sink-1") return undefined;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderWith(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{node}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const changes = () =>
  vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));

describe("Monitoring › Log streams", () => {
  it("says a failing destination keeps its events, and offers no test it can't send", async () => {
    renderWith(<LogStreamsPage />);
    expect(await screen.findByText("Can't deliver to ingest.logs.example.com")).toBeTruthy();
    expect(screen.getByText(/keeps the events and tries again/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /test/i })).toBeNull();
  });

  it("asks for an HTTPS endpoint before adding a destination as a sensitive action", async () => {
    renderWith(<LogStreamsPage />);
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Add destination" }))[0] as HTMLElement,
    );
    const endpoint = screen.getByRole("textbox", { name: "Endpoint URL" });
    fireEvent.change(endpoint, { target: { value: "http://logs.example.com" } });
    fireEvent.submit(endpoint.closest("form") as HTMLFormElement);
    expect(await screen.findByText(/Enter an HTTPS address/)).toBeTruthy();
    expect(changes()).toEqual([]);

    fireEvent.change(endpoint, { target: { value: "https://logs.example.com/qeet-id" } });
    fireEvent.submit(endpoint.closest("form") as HTMLFormElement);
    await waitFor(() => expect(changes()).toEqual(["POST /v1/tenants/t-1/log-sinks"]));
    expect(sensitiveCalls.at(-1)?.confirm).toBeUndefined();
  });

  it("pauses without asking, and asks before removing, saying what is lost", async () => {
    renderWith(<LogStreamsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    await waitFor(() => expect(changes()).toEqual(["PATCH /v1/tenants/t-1/log-sinks/sink-1"]));

    fireEvent.click(screen.getByRole("button", { name: "Remove ingest.logs.example.com" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/the events in between aren't sent/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(changes()).toEqual(["PATCH /v1/tenants/t-1/log-sinks/sink-1"]);
  });
});
