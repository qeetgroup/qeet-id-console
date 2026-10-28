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
  useLocation: () => ({ pathname: "/security/rate-limits", searchStr: "", hash: "" }),
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
import { RateLimitsPage } from "../components/rate-limits-page";

let limits = {
  tenant: { rate: 100, capacity: 500 },
  user: { rate: 30, capacity: 100 },
  api_key: { rate: 50, capacity: 200 },
};

beforeEach(() => {
  limits = {
    tenant: { rate: 100, capacity: 500 },
    user: { rate: 30, capacity: 100 },
    api_key: { rate: 50, capacity: 200 },
  };
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/rate-limits" && method === "GET") return limits;
    if (path === "/v1/tenants/t-1/rate-limits" && method === "PUT")
      return { ...limits, ...(options?.body as object) };
    if (path === "/v1/tenants/t-1/rate-limits" && method === "DELETE") return undefined;
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

describe("Security › Rate limits", () => {
  it("shows the organisation's limits and the built-in ones the server uses", async () => {
    renderWith(<RateLimitsPage />);
    expect(await screen.findByText("30 a second, bursts of 100")).toBeTruthy();
    expect(screen.getByText("Platform limits")).toBeTruthy();
    // The token endpoint's real bucket (router.go), not the old page's 5 a second.
    expect(screen.getAllByText("50 a second, bursts of 200").length).toBeGreaterThan(1);
    // Nothing to reset while they're the platform's.
    expect(screen.queryByRole("button", { name: "Use the platform's" })).toBeNull();
  });

  it("holds a limit to the platform's, then sends only the bucket changed", async () => {
    renderWith(<RateLimitsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Change Each person" }));
    const rate = screen.getByRole("textbox", { name: "Requests a second" }) as HTMLInputElement;
    expect(screen.getByText("At most 30")).toBeTruthy();
    fireEvent.change(rate, { target: { value: "45" } });
    fireEvent.blur(rate);
    // The field stops at the platform's 30, the most the server takes.
    await waitFor(() => expect(rate.value).toBe("30"));

    fireEvent.change(rate, { target: { value: "10" } });
    fireEvent.blur(rate);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/rate-limits"]));
    const put = vi.mocked(api).mock.calls.find(([, o]) => o?.method === "PUT");
    expect(put?.[1]?.body).toEqual({ user: { rate: 10, capacity: 100 } });
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Change a rate limit");
  });

  it("asks before going back to the platform's limits", async () => {
    limits = { ...limits, user: { rate: 10, capacity: 50 } };
    renderWith(<RateLimitsPage />);
    expect(await screen.findByText("Lowered")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use the platform's" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(changes()).toEqual([]);
  });
});
