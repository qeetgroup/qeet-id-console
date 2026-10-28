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
  useLocation: () => ({ pathname: "/security/threats/bots", searchStr: "", hash: "" }),
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
import { BotsPage } from "../components/threats/bots-page";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const SETTINGS = {
  ua_check: true,
  honeypot: true,
  captcha: false,
  signature: false,
  score_threshold: 0.7,
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/security/bots")
      return {
        recent: [
          {
            id: "b1",
            ip: "203.0.113.9",
            user_agent: "curl/8.7.1",
            score: 0.95,
            verdict: "blocked",
            created_at: ago(5),
          },
          {
            id: "b2",
            ip: "203.0.113.9",
            user_agent: "curl/8.7.1",
            score: 0.95,
            verdict: "blocked",
            created_at: ago(9),
          },
          {
            id: "b3",
            ip: "198.51.100.7",
            user_agent: "okhttp/4.12.0",
            score: 0.55,
            verdict: "challenged",
            created_at: ago(30),
          },
        ],
        stats: { blocked_24h: 2, challenged_24h: 1, threshold: 0.7 },
      };
    if (path === "/v1/tenants/t-1/security/bots/settings" && method === "GET") return SETTINGS;
    if (path === "/v1/tenants/t-1/security/bots/settings" && method === "PUT") return options?.body;
    if (path === "/v1/tenants/t-1/ip-rules") return { enabled: false, items: [] };
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

describe("Threats › Bots", () => {
  it("lists one row per client and address, and says nothing is refused", async () => {
    renderWith(<BotsPage filters={{}} onFiltersChange={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Automated clients" });
    await waitFor(() => expect(within(table).getByText("curl 8.7.1")).toBeTruthy());
    expect(within(table).getAllByRole("row")).toHaveLength(3); // the header and two clients
    expect(screen.getByText("Detection only")).toBeTruthy();
    expect(screen.queryByText(/honeypot|captcha/i)).toBeNull();
  });

  it("stops scoring with the stored settings it doesn't offer left as they were", async () => {
    renderWith(<BotsPage filters={{}} onFiltersChange={vi.fn()} />);
    const scoring = await screen.findByRole("switch", { name: "Score sign-ins" });
    await waitFor(() => expect(scoring.getAttribute("aria-checked")).toBe("true"));
    fireEvent.click(scoring);
    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/security/bots/settings"]));
    const put = vi.mocked(api).mock.calls.find(([, o]) => o?.method === "PUT");
    expect(put?.[1]?.body).toEqual({ ...SETTINGS, ua_check: false });
  });

  it("asks before denying a client's address, saying nothing is refused while IP rules are off", async () => {
    renderWith(<BotsPage filters={{}} onFiltersChange={vi.fn()} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Actions for curl 8.7.1 from 203.0.113.9" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Deny 203.0.113.9" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Nothing is refused yet: IP rules are off/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(changes()).toEqual([]);
  });
});
