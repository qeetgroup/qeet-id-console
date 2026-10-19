// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ can: () => true }),
}));
vi.mock("@/platform/security/sensitive-action-provider", () => ({
  SensitiveActionCancelled: class extends Error {},
  useSensitiveAction: () => vi.fn(),
}));
vi.mock("@/shared/hooks/use-create-intent", async () => {
  const { useState } = await import("react");
  return { parseCreateIntent: () => ({}), useCreateIntent: () => useState(false) };
});

import { api } from "@/platform/api/client";
import { Route } from "./keys";

const ApiKeysPage = Route.options.component as () => React.JSX.Element;

// The 201 body as the published contract (developer.yaml, POST /v1/api-keys)
// describes it: the key, its plaintext secret once, and a warning.
function created(name: string, secret?: string) {
  return {
    api_key: {
      id: `id-${name}`,
      tenant_id: "tenant-1",
      name,
      prefix: "qk_7Qx8t",
      scopes: ["users:read"],
      expires_at: null,
      created_at: "2026-09-24T10:15:00Z",
    },
    ...(secret ? { secret } : {}),
    warning: "The secret is shown only once. Store it now; it cannot be retrieved again.",
  };
}

let responses: ReturnType<typeof created>[];

beforeEach(() => {
  responses = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/tenant-1/api-keys") return { items: [] };
    if (path === "/v1/api-keys" && options?.method === "POST") return responses.shift();
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
      <ApiKeysPage />
    </QueryClientProvider>,
  );
}

async function createKey(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /new api key/i }));
  fireEvent.change(await screen.findByLabelText("Name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: /create key/i }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /create key/i })).toBeNull());
}

describe("API keys — revealing a new key", () => {
  it("shows the new key's name and its full secret", async () => {
    responses.push(created("CI deploy bot", "qk_7Qx8t3f0a1b2c3d4e5f6g7h8i9j0k1l2"));
    renderPage();

    await createKey("CI deploy bot");

    expect(await screen.findByText("qk_7Qx8t3f0a1b2c3d4e5f6g7h8i9j0k1l2")).toBeTruthy();
    expect(screen.getByText(/only time we'll show CI deploy bot/)).toBeTruthy();
  });

  it("reveals each new key's own secret", async () => {
    responses.push(created("first", "qk_first_secret"), created("second", "qk_second_secret"));
    renderPage();

    await createKey("first");
    expect(await screen.findByText("qk_first_secret")).toBeTruthy();

    await createKey("second");
    expect(await screen.findByText("qk_second_secret")).toBeTruthy();
    expect(screen.queryByText("qk_first_secret")).toBeNull();
    expect(screen.getByText(/only time we'll show second/)).toBeTruthy();
  });

  it("shows an error, not an empty copy field, when no secret comes back", async () => {
    responses.push(created("no secret"));
    renderPage();

    await createKey("no secret");

    expect(await screen.findByText(/secret didn't come back/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
  });
});
