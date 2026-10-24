// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/platform/security/sensitive-action-provider", () => ({
  SensitiveActionCancelled: class extends Error {},
  useSensitiveAction: () => vi.fn(),
}));

import { api } from "@/platform/api/client";
import { Route } from "./signing-keys";

const SigningKeysPage = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/oidc/signing-keys" && !options?.method) {
      return {
        keys: [
          { kid: "kid-active", alg: "ES256", use: "sig", status: "active" },
          { kid: "kid-retired", alg: "ES256", use: "sig", status: "retired" },
        ],
      };
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SigningKeysPage />
    </QueryClientProvider>,
  );
}

describe("Signing keys — rotation is by deployment", () => {
  it("lists the published keys with nothing to rotate them", async () => {
    renderPage();

    expect(await screen.findByText("kid-active")).toBeTruthy();
    expect(screen.getByText("kid-retired")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /rotate/i })).toBeNull();
  });

  it("says keys rotate by deployment and links the procedure", async () => {
    renderPage();
    await screen.findByText("kid-active");

    expect(screen.getByText(/rotate by deployment/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /rotation procedure/i });
    expect(link.getAttribute("href")).toBe(
      "https://docs.id.qeet.in/docs/security/encryption-and-keys",
    );
  });
});
