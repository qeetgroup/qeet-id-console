// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
// Records each sensitive action's options while the real provider runs it.
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
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { RegisterApplicationSheet } from "../register-application-sheet";

const created = {
  id: "app-1",
  tenant_id: "tenant-1",
  client_id: "cid-app-1",
  name: "Billing portal",
  type: "confidential" as const,
  redirect_uris: ["https://billing.example.com/callback"],
  grant_types: ["authorization_code", "refresh_token"],
  scopes: ["openid", "profile", "email"],
  created_at: "2026-09-24T10:15:00Z",
};

let failure: Error | undefined;

beforeEach(() => {
  failure = undefined;
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/oidc/clients" && options?.method === "POST") {
      if (failure) throw failure;
      return { client: created, client_secret: "cs_once", warning: "shown once" };
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

function renderSheet() {
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <RegisterApplicationSheet open onOpenChange={onOpenChange} onCreated={onCreated} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onCreated, onOpenChange };
}

function submit() {
  const sheet = screen.getByRole("dialog");
  fireEvent.change(within(sheet).getByLabelText(/^Name/), { target: { value: "Billing portal" } });
  fireEvent.change(within(sheet).getByLabelText(/^Redirect URIs/), {
    target: { value: "https://billing.example.com/callback" },
  });
  fireEvent.click(within(sheet).getByRole("button", { name: "Register application" }));
}

describe("RegisterApplicationSheet", () => {
  it("registers through the sensitive-action path, the submit being the confirmation", async () => {
    const { onCreated, onOpenChange } = renderSheet();

    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created, "cs_once"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(sensitive.calls).toHaveLength(1);
    expect(sensitive.calls[0]?.actionLabel).toBe("Register this application");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("stays open with a curated message when registration fails", async () => {
    failure = new ApiError(500, "internal", "pq: duplicate key value");
    const { onCreated, onOpenChange } = renderSheet();

    submit();

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/pq:/)).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
