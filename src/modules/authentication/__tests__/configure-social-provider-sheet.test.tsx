// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn(), getApiBaseUrl: () => "" }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
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
import { ConfigureSocialProviderSheet } from "../components/configure-social-provider-sheet";
import { SOCIAL_PROVIDERS } from "../components/social-provider-catalogue";

const google = SOCIAL_PROVIDERS.find((p) => p.id === "google");
const onClose = vi.fn();

beforeEach(() => {
  sensitiveCalls.length = 0;
  onClose.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/social/providers" && method === "POST") return {};
    if (path === "/v1/social/providers/google" && (method === "PATCH" || method === "DELETE")) {
      return undefined;
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

function renderSheet() {
  if (!google) throw new Error("The catalogue has no Google entry");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <ConfigureSocialProviderSheet
          provider={google}
          existing={{
            tenant_id: "tenant-1",
            provider: "google",
            client_id: "client-1",
            discovery_url: "https://accounts.google.com/.well-known/openid-configuration",
            enabled: true,
            updated_at: new Date().toISOString(),
          }}
          onClose={onClose}
        />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));
}

describe("ConfigureSocialProviderSheet", () => {
  it("removes the provider only once the confirmation is accepted, then closes", async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: "Remove provider" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove Google?")).toBeTruthy();
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/social/providers/google"]));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Remove this social provider" });
  });

  it("keeps the provider when the confirmation is cancelled", async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: "Remove provider" }));
    const dialog = await screen.findByRole("alertdialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("switches the provider off through the step-up path without a confirmation", async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole("switch"));

    await waitFor(() => expect(writes()).toEqual(["PATCH /v1/social/providers/google"]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Turn this social provider off" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("saves the credentials through the step-up path, the save being the confirmation", async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: "Save provider" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/social/providers"]));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Save this social provider" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
