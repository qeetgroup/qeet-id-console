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
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
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

import { toast } from "sonner";
import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./secrets";

const SecretsPage = Route.options.component as () => React.JSX.Element;

const BASE = "/v1/tenants/tenant-1/secrets";
const secret = {
  id: "sec-1",
  name: "stripe.api_key",
  scope: "billing",
  last4: "9xYz",
  created_at: "2026-09-24T10:15:00Z",
  updated_at: "2026-09-24T10:15:00Z",
};

let revealFailure: Error | undefined;

beforeEach(() => {
  revealFailure = undefined;
  sensitive.calls = [];
  vi.mocked(toast.error).mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === BASE && !options?.method) return { items: [secret] };
    if (path === `${BASE}/sec-1/reveal` && options?.method === "POST") {
      if (revealFailure) throw revealFailure;
      return { value: "sk_live_plaintext" };
    }
    if (path === BASE && options?.method === "POST") return secret;
    if (path === `${BASE}/sec-1` && options?.method === "PATCH") return secret;
    if (path === `${BASE}/sec-1` && options?.method === "DELETE") return undefined;
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
        <SecretsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

describe("Secrets — revealing a value", () => {
  it("reveals through the sensitive-action path into a one-time panel, and hides it", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /reveal/i }));

    expect(await screen.findByText("sk_live_plaintext")).toBeTruthy();
    expect(screen.getByText("Value of stripe.api_key")).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
    expect(sensitive.calls[0]?.actionLabel).toBe("reveal this secret");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();

    // Both the row toggle and the panel's dismiss button read "Hide".
    fireEvent.click(screen.getAllByRole("button", { name: /hide/i })[0] as HTMLElement);
    await waitFor(() => expect(screen.queryByText("sk_live_plaintext")).toBeNull());
  });

  it("keeps the table masked while a value is revealed", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /reveal/i }));
    await screen.findByText("sk_live_plaintext");

    expect(screen.getByText("••••••••9xYz")).toBeTruthy();
  });

  it("says when a reveal fails, since the reveal itself reports nothing", async () => {
    revealFailure = new ApiError(500, "internal", "pq: connection refused");
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /reveal/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain("pq:");
  });
});

describe("Secrets — changing them", () => {
  it("creates a secret through the sensitive-action path, the submit being the confirmation", async () => {
    renderPage();
    await screen.findByText("stripe.api_key");

    fireEvent.click(screen.getByRole("button", { name: /new secret/i }));
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "github.token" } });
    fireEvent.change(screen.getByLabelText(/^Value/), { target: { value: "ghp_x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create secret" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(BASE, expect.objectContaining({ method: "POST" })),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("create this secret");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("rotates a secret through the sensitive-action path", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /rotate/i }));
    fireEvent.change(await screen.findByLabelText(/^New value/), { target: { value: "sk_new" } });
    fireEvent.click(screen.getByRole("button", { name: "Rotate secret" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        `${BASE}/sec-1`,
        expect.objectContaining({ method: "PATCH", body: { value: "sk_new" } }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("rotate this secret");
  });

  it("deletes a secret only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain('Delete secret "stripe.api_key"?');
    expect(api).not.toHaveBeenCalledWith(`${BASE}/sec-1`, expect.anything());

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        `${BASE}/sec-1`,
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("delete this secret");
  });
});
