// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({
  api: vi.fn(),
  getApiBaseUrl: () => "https://api.example.com",
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
// Records each sensitive action's options while the real provider confirms and runs it.
const sensitive = vi.hoisted(() => ({ calls: [] as SensitiveActionOptions<unknown>[] }));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return <T,>(options: SensitiveActionOptions<T>) => {
        sensitive.calls.push(options);
        return run(options);
      };
    },
  };
});
vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: { features: { scim: true } } }),
  FeatureGate: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./scim";

const ScimPage = Route.options.component as () => React.JSX.Element;

const BASE = "/v1/tenants/tenant-1/scim";
let tokenSet: boolean;

function config() {
  return {
    token_set: tokenSet,
    token_prefix: "qf_scim_",
    created_at: null,
    last_used_at: null,
    provisioned_count: 0,
  };
}

beforeEach(() => {
  tokenSet = false;
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === BASE) return config();
    if (path === `${BASE}/users`) return { items: [] };
    if (path === `${BASE}/token` && options?.method === "POST") {
      tokenSet = true;
      return { token: "qf_scim_fresh_token", config: config() };
    }
    if (path === `${BASE}/token` && options?.method === "DELETE") {
      tokenSet = false;
      return undefined;
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
        <ScimPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function calledWith(path: string, method: string) {
  return vi.mocked(api).mock.calls.some(([p, o]) => p === path && o?.method === method);
}

describe("SCIM — issuing a token", () => {
  it("generates a first token without a confirmation and shows it once until saved", async () => {
    renderPage();

    const generate = await screen.findByRole("button", { name: /generate/i });
    await waitFor(() => expect(generate.hasAttribute("disabled")).toBe(false));
    fireEvent.click(generate);

    expect(await screen.findByText("qf_scim_fresh_token")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitive.calls[0]?.actionLabel).toBe("generate a SCIM token");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(screen.queryByText("qf_scim_fresh_token")).toBeNull();
  });

  it("rotates an existing token only after the admin confirms", async () => {
    tokenSet = true;
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /rotate/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Rotate the SCIM token?");
    expect(calledWith(`${BASE}/token`, "POST")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Rotate" }));

    expect(await screen.findByText("qf_scim_fresh_token")).toBeTruthy();
    expect(sensitive.calls[0]?.actionLabel).toBe("rotate the SCIM token");
  });
});

describe("SCIM — disabling provisioning", () => {
  it("revokes the token only after the admin confirms", async () => {
    tokenSet = true;
    renderPage();

    const toggle = await screen.findByRole("switch");
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    fireEvent.click(toggle);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Disable SCIM provisioning?");
    expect(calledWith(`${BASE}/token`, "DELETE")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Disable" }));

    await waitFor(() => expect(calledWith(`${BASE}/token`, "DELETE")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("disable SCIM provisioning");
  });
});
