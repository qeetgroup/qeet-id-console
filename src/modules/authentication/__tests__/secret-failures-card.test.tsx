// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({
  api: vi.fn(),
  getApiBaseUrl: () => "https://api.id.example",
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));

import { api } from "@/platform/api/client";
import type { OidcClient } from "../api/oidc-clients";
import { SecretFailuresCard } from "../components/secret-failures-card";

const app: OidcClient = {
  id: "row-1",
  tenant_id: "t-1",
  client_id: "qci_app",
  name: "Acme",
  type: "confidential",
  redirect_uris: ["https://app.example/cb"],
  grant_types: ["authorization_code"],
  scopes: ["openid"],
  created_at: "2026-10-01T00:00:00Z",
};

function serve(body: unknown) {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/v1/tenants/t-1/oidc/clients/row-1/auth-failures") return body;
    throw new Error(`Unexpected request ${path}`);
  });
}

function renderCard(client: OidcClient = app) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SecretFailuresCard client={client} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api).mockReset();
});
afterEach(cleanup);

describe("An application's secret attempts", () => {
  it("lists recent failures with their address, and says when a lockout ends", async () => {
    serve({
      locked_until: "2026-10-20T12:15:00Z",
      items: [
        { at: "2026-10-20T12:00:00Z", ip: "203.0.113.5", reason: "invalid_secret" },
        { at: "2026-10-20T11:59:00Z", ip: "203.0.113.6", reason: "invalid_secret" },
      ],
    });
    renderCard();
    expect(await screen.findByText("203.0.113.5")).toBeTruthy();
    expect(screen.getByText("203.0.113.6")).toBeTruthy();
    expect(screen.getByText("Locked out")).toBeTruthy();
    expect(screen.getByText(/^Locked out until /)).toBeTruthy();
  });

  it("says so when there are no recent failures", async () => {
    serve({ locked_until: null, items: [] });
    renderCard();
    expect(await screen.findByText("No recent failed attempts.")).toBeTruthy();
    expect(screen.queryByText("Locked out")).toBeNull();
  });

  it("shows nothing for a public application, which has no secret", () => {
    const { container } = renderCard({ ...app, type: "public" });
    expect(container.textContent).toBe("");
    expect(api).not.toHaveBeenCalled();
  });
});
