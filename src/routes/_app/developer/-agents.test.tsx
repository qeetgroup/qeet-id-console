// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "tenant-1",
  useMe: () => ({ data: { id: "user-1" } }),
}));
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
// A native select stands in for the searchable combobox, which jsdom can't drive reliably.
vi.mock("@qeetrix/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@qeetrix/ui")>()),
  Combobox: ({
    id,
    items,
    value,
    onValueChange,
  }: {
    id: string;
    items: { label: string; value: string }[];
    value: string | null;
    onValueChange: (v: string | null) => void;
  }) => (
    <select id={id} value={value ?? ""} onChange={(e) => onValueChange(e.target.value || null)}>
      <option value="" />
      {items.map((i) => (
        <option key={i.value} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  ),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./agents";

const AgentsPage = Route.options.component as () => React.JSX.Element;

const BASE = "/v1/tenants/tenant-1/agents";
const agent = {
  id: "agent-1",
  name: "support-assistant",
  scopes: ["tickets:read"],
  token_ttl_seconds: 600,
  status: "active",
  disabled: false,
  sponsor_user_id: "user-1",
  created_at: "2026-09-24T10:15:00Z",
};

beforeEach(() => {
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === BASE && !options?.method) return { items: [agent] };
    if (path === BASE && options?.method === "POST") {
      return { ...agent, id: "agent-2", name: "triage-bot", secret: "ag_secret_value" };
    }
    if (path === `${BASE}/agent-1` && options?.method === "PATCH") return undefined;
    if (path === `${BASE}/agent-1` && options?.method === "DELETE") return undefined;
    if (path === `${BASE}/kill-all` && options?.method === "POST") return { suspended: 1 };
    if (path === "/v1/users") {
      return {
        items: [
          { id: "user-1", email: "ada@example.com" },
          { id: "user-2", email: "grace@example.com" },
        ],
      };
    }
    if (path === `${BASE}/sponsored-by/user-1`) return { items: [agent] };
    if (path === `${BASE}/sponsored-by/user-1/transfer` && options?.method === "POST") {
      return { transferred: 1 };
    }
    if (path === "/v1/tenants/tenant-1/oidc/clients/shadow-ai") return { items: [] };
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
        <AgentsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function calledWith(path: string, method: string) {
  return vi.mocked(api).mock.calls.some(([p, o]) => p === path && o?.method === method);
}

describe("Agents — creating one", () => {
  it("creates through the sensitive-action path and shows the credentials once", async () => {
    renderPage();
    await screen.findByText("support-assistant");

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "triage-bot" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("secret=ag_secret_value")).toBeTruthy();
    expect(screen.getByText("agent_id=agent-2")).toBeTruthy();
    expect(sensitive.calls[0]?.actionLabel).toBe("create this agent");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("secret=ag_secret_value")).toBeNull();
  });
});

describe("Agents — stopping and removing them", () => {
  it("suspends every agent only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /suspend all/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Suspend all 1 active agent(s)?");
    expect(calledWith(`${BASE}/kill-all`, "POST")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend All" }));

    await waitFor(() => expect(calledWith(`${BASE}/kill-all`, "POST")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("suspend every active agent");
  });

  it("suspends one agent through the sensitive-action path", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /^suspend$/i }));

    await waitFor(() => expect(calledWith(`${BASE}/agent-1`, "PATCH")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("suspend this agent");
  });

  it("deletes an agent only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete agent “support-assistant”?");
    expect(calledWith(`${BASE}/agent-1`, "DELETE")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(calledWith(`${BASE}/agent-1`, "DELETE")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("delete this agent");
  });

  it("transfers a sponsor's agents only after the admin confirms", async () => {
    renderPage();

    await waitFor(() => expect(document.querySelectorAll("#sponsor-to option")).toHaveLength(3));
    fireEvent.change(screen.getByLabelText("From (departing sponsor)"), {
      target: { value: "user-1" },
    });
    fireEvent.change(screen.getByLabelText("To (new sponsor)"), { target: { value: "user-2" } });
    await screen.findByText(/1 agent sponsored by this user will move/);

    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(calledWith(`${BASE}/sponsored-by/user-1/transfer`, "POST")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Transfer" }));

    await waitFor(() =>
      expect(calledWith(`${BASE}/sponsored-by/user-1/transfer`, "POST")).toBe(true),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("transfer these agents");
  });
});
