// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));

import { api } from "@/platform/api/client";
import { Route } from "./ip-allowlist";

const IpRulesPage = Route.options.component as () => React.JSX.Element;

const officeRule = {
  id: "rule-office",
  tenant_id: "t-1",
  cidr: "192.0.2.0/24",
  label: "Attackers",
  action: "deny",
  created_at: "2026-10-20T08:00:00Z",
};

function serve(enabled: boolean) {
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1/ip-rules" && !options?.method) {
      return { enabled, items: [officeRule] };
    }
    if (path === "/v1/tenants/t-1/audit" && !options?.method) {
      expect(options?.query?.action).toBe("auth.address_refused");
      return {
        items: [
          {
            id: "ev-1",
            created_at: "2026-10-20T09:00:00Z",
            ip: "192.0.2.10",
            metadata: {
              address: "192.0.2.10",
              path: "hosted_password",
              reason: "deny_rule",
              rule_id: "rule-office",
              cidr: "192.0.2.0/24",
            },
          },
          {
            id: "ev-2",
            created_at: "2026-10-20T09:05:00Z",
            ip: "198.51.100.4",
            metadata: {
              address: "198.51.100.4",
              path: "refresh",
              reason: "deny_rule",
              rule_id: "rule-gone",
              cidr: "198.51.100.0/24",
            },
          },
          {
            id: "ev-3",
            created_at: "2026-10-20T09:10:00Z",
            ip: "203.0.113.9",
            metadata: { address: "203.0.113.9", path: "passkey", reason: "not_in_allow_rules" },
          },
        ],
        next_cursor: "",
      };
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
}

beforeEach(() => {
  vi.mocked(api).mockReset();
});
afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <IpRulesPage />
    </QueryClientProvider>,
  );
}

describe("IP rules — what they cover and what they refused", () => {
  it("lists recent refusals with the method and the rule responsible, linked to it", async () => {
    serve(true);
    renderPage();

    expect(await screen.findByText("192.0.2.10")).toBeTruthy();
    const ruleLink = screen.getByRole("link", { name: /192\.0\.2\.0\/24/ });
    expect(ruleLink.getAttribute("href")).toBe("#rule-rule-office");
    expect(screen.getByText("Password")).toBeTruthy();
    expect(screen.getByText("Session renewal")).toBeTruthy();
    expect(screen.getByText("198.51.100.0/24 (removed)")).toBeTruthy();
    expect(screen.getByText("Outside every allow rule")).toBeTruthy();
  });

  it("says which sign-ins the rules cover and that an unknown address is refused", async () => {
    serve(true);
    renderPage();

    expect(await screen.findByText(/every sign-in to this organization is checked/)).toBeTruthy();
    expect(screen.getByText(/password, passkey, magic link, social/)).toBeTruthy();
    expect(screen.getByText("If an address can't be determined, sign-in is refused.")).toBeTruthy();
    expect(screen.getByText(/console signs you in from its own server/)).toBeTruthy();
  });

  it("says the rules are stored but not applied while enforcement is off", async () => {
    serve(false);
    renderPage();

    expect(await screen.findByText(/stored but not applied to any sign-in/)).toBeTruthy();
    expect(screen.queryByText(/every sign-in to this organization is checked/)).toBeNull();
  });
});
