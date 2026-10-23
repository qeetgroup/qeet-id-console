// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => actions ?? null,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each sensitive action asked for, then runs it through the real provider.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
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

let checkAnswer: Record<string, unknown> = {};

function serve(enabled: boolean) {
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1/ip-rules/check" && options?.method === "POST") return checkAnswer;
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
    if (path === "/v1/tenants/t-1/ip-rules/config" && options?.method === "PUT") {
      return { enabled: !enabled };
    }
    if (path === "/v1/tenants/t-1/ip-rules" && options?.method === "POST") return officeRule;
    if (path === "/v1/tenants/t-1/ip-rules/rule-office" && options?.method === "DELETE") {
      return undefined;
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
}

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
});
afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <IpRulesPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function changes() {
  return vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));
}

async function openRemoveConfirmation(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  const dialog = cancel.closest('[role="alertdialog"], [role="dialog"]');
  if (!dialog) throw new Error("Confirmation dialog is missing");
  return dialog as HTMLElement;
}

describe("IP rules — testing an address", () => {
  async function check(answer: Record<string, unknown>) {
    checkAnswer = answer;
    serve(true);
    renderPage();
    fireEvent.change(await screen.findByLabelText(/^IP address/), {
      target: { value: "192.0.2.10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    await screen.findByText(answer.allowed ? "Allowed" : "Blocked");
  }

  it("words the result from its reason code, naming the deny rule", async () => {
    await check({
      enabled: true,
      allowed: false,
      reason: "refused by the deny rule 192.0.2.0/24",
      reason_code: "ip.deny_rule",
      reason_params: { cidr: "192.0.2.0/24" },
    });
    expect(screen.getByText("The deny rule 192.0.2.0/24 matches it.")).toBeTruthy();
    expect(screen.queryByText("refused by the deny rule 192.0.2.0/24")).toBeNull();
  });

  it("still words a server's bare reason without a code", async () => {
    await check({ enabled: true, allowed: false, reason: "not_in_allow_rules" });
    expect(screen.getByText("No allow rule matches it.")).toBeTruthy();
  });

  it("never shows a reason sentence it has no code for", async () => {
    await check({ enabled: true, allowed: false, reason: "some new refusal" });
    expect(screen.queryByText("some new refusal")).toBeNull();
  });
});

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

describe("IP rules — changes are sensitive actions", () => {
  it("switches enforcement through the sensitive-action path, without a confirmation", async () => {
    serve(false);
    renderPage();
    await screen.findByText("Attackers"); // the switch waits for the rules to load
    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/ip-rules/config"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Change IP rule enforcement");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("adds a rule through the sensitive-action path, without a confirmation", async () => {
    serve(true);
    renderPage();
    fireEvent.change(await screen.findByPlaceholderText("203.0.113.0/24"), {
      target: { value: "198.51.100.0/24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() => expect(changes()).toEqual(["POST /v1/tenants/t-1/ip-rules"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Add an IP rule");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("confirms before removing a rule, naming the range it no longer refuses", async () => {
    serve(true);
    renderPage();
    const dialog = await openRemoveConfirmation();

    expect(within(dialog).getByText("Remove this IP rule?")).toBeTruthy();
    expect(dialog.textContent).toContain(
      "Sign-ins from 192.0.2.0/24 will no longer be refused by this rule.",
    );
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Remove this IP rule");
    expect(changes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove rule" }));
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/tenants/t-1/ip-rules/rule-office"]));
  });

  it("keeps the rule when the removal is cancelled", async () => {
    serve(true);
    renderPage();
    const dialog = await openRemoveConfirmation();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
    expect(changes()).toEqual([]);
  });
});
