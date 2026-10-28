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
  useLocation: () => ({ pathname: "/security/sessions", searchStr: "", hash: "" }),
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
import { SessionsPage } from "../components/sessions-page";

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    const now = new Date().toISOString();
    const session = (id: string, ua: string) => ({
      id,
      user_id: "u-me",
      tenant_id: "t-1",
      ip: "203.0.113.9",
      user_agent: ua,
      created_at: now,
      last_seen_at: now,
      revoked_at: null,
    });
    if (method === "GET" && path === "/v1/auth/sessions")
      return {
        items: [
          session("s-1", "Mozilla/5.0 (Macintosh) Chrome/155.0"),
          session("s-2", "Mozilla/5.0 (Windows NT 10.0) Firefox/150.0"),
        ],
      };
    if (method === "DELETE" && path === "/v1/auth/sessions/s-2") return undefined;
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

describe("Security › Sessions", () => {
  it("puts this device first and asks before signing another session out", async () => {
    renderWith(<SessionsPage />);
    expect(await screen.findByText("Active now")).toBeTruthy();
    const signOut = await screen.findByRole("button", { name: /^Sign out of (?!all others)/ });
    fireEvent.click(signOut);
    const dialog = await screen.findByRole("alertdialog");
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Sign out of a session");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(changes()).toEqual([]);

    fireEvent.click(signOut);
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sign out" }),
    );
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/auth/sessions/s-2"]));
  });
});
