// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
// Records what each action asks the shared sensitive-action runner for, then runs it for real.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (o: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(o);
        return run(o);
      };
    },
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./passwordless";

const Page = Route.options.component as () => React.JSX.Element;
const POLICY_PATH = "/v1/tenants/tenant-1/auth-policy";

let saved: Record<string, unknown> | undefined;

beforeEach(() => {
  saved = undefined;
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === POLICY_PATH && (options?.method ?? "GET") === "GET") {
      return {
        password_enabled: true,
        magic_link_enabled: true,
        magic_link_ttl_minutes: 60,
        passkey_enabled: true,
        otp_email_enabled: false,
        otp_sms_enabled: false,
        remember_device_enabled: false,
      };
    }
    if (path === POLICY_PATH && options?.method === "PUT") {
      saved = options.body as Record<string, unknown>;
      return saved;
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

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

describe("Login methods › Passwordless", () => {
  it("saves the policy through the step-up path, the save being the confirmation", async () => {
    renderPage();
    // Save stays off until something changes.
    const save = (await screen.findByRole("button", { name: "Save changes" })) as HTMLButtonElement;
    expect(save.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("switch", { name: /trusted devices/i }));
    fireEvent.click(save);

    await waitFor(() => expect(saved).toBeDefined());
    expect(saved).toMatchObject({ passkey_enabled: true, remember_device_enabled: true });
    expect(sensitiveCalls).toHaveLength(1);
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Change how people sign in" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
