// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

import type { LoginDomainStatus } from "../api/domains";

const state = vi.hoisted(() => ({ status: undefined as LoginDomainStatus | undefined }));
vi.mock("../api/domains", () => ({ useLoginDomain: () => ({ data: state.status }) }));
vi.mock("@/modules/branding", () => ({
  brandingKeys: { tenant: (id: string) => ["branding", id] },
  saveBranding: vi.fn(),
  useBranding: () => ({ data: { custom_domain: "login.acme.com" } }),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));

import { CustomLoginDomainTab } from "../components/custom-login-domain-tab";

const pending: LoginDomainStatus = {
  login_domain: "login.acme.com",
  status: "pending",
  dns_verified: true,
  dns_detail: "",
  tls_state: "pending",
  tls_detail: "",
  endpoint_state: "not_available",
  records: [],
};

function renderTab(status: LoginDomainStatus) {
  state.status = status;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CustomLoginDomainTab />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("A custom login domain's status", () => {
  it("says it is live once the certificate is issued and the endpoint answers", () => {
    renderTab({
      ...pending,
      status: "active",
      tls_state: "issued",
      endpoint_state: "live",
      endpoint_url: "https://login.acme.com",
    });

    expect(screen.getByText("Custom hosted login is live")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
    expect(screen.getByText("Issued")).toBeTruthy();
    // The endpoint stage names the address it answers on.
    expect(screen.getByText("Live").parentElement?.textContent).toContain("https://login.acme.com");
    expect(screen.queryByText(/Waiting for verification/)).toBeNull();
    expect(screen.queryByText("Not started")).toBeNull();
    expect(screen.queryByText("Not available")).toBeNull();
  });

  it("says it is in progress, and waiting, while it provisions", () => {
    renderTab(pending);

    expect(screen.getByText("Custom hosted login in progress")).toBeTruthy();
    expect(screen.getByText("DNS pending")).toBeTruthy();
    expect(screen.getByText(/Waiting for verification/)).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
    expect(screen.queryByText("Live")).toBeNull();
  });
});
