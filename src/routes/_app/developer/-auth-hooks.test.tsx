// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./auth-hooks";

const AuthHooksPage = Route.options.component as () => React.JSX.Element;

const BASE = "/v1/tenants/tenant-1/auth-hooks";
const hook = {
  id: "hook-1",
  trigger: "post_authentication",
  url: "https://hooks.example.com/gate",
  enabled: true,
  fail_open: true,
  created_at: "2026-09-24T10:15:00Z",
};

beforeEach(() => {
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === BASE && !options?.method) return { items: [hook] };
    if (path === BASE && options?.method === "POST") return hook;
    if (path === `${BASE}/hook-1` && options?.method === "PATCH") return undefined;
    if (path === `${BASE}/hook-1` && options?.method === "DELETE") return undefined;
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
        <AuthHooksPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

describe("Auth hooks — sensitive actions", () => {
  it("adds a hook through the sensitive-action path, the submit being the confirmation", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^Hook URL/), {
      target: { value: "https://hooks.example.com/new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(BASE, expect.objectContaining({ method: "POST" })),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("add this hook");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("turns a hook off through the sensitive-action path", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("switch", { name: /enabled/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        `${BASE}/hook-1`,
        expect.objectContaining({ method: "PATCH", body: { enabled: false, fail_open: true } }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("turn this hook off");
  });

  it("removes a hook only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Remove this hook?");
    expect(api).not.toHaveBeenCalledWith(
      `${BASE}/hook-1`,
      expect.objectContaining({ method: "DELETE" }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        `${BASE}/hook-1`,
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("remove this hook");
  });
});
