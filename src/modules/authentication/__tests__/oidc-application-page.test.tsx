// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({
  api: vi.fn(),
  getApiBaseUrl: () => "https://api.id.example",
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
  useNavigate: () => vi.fn(),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { OidcClient, UpdateOidcInput } from "../api/oidc-clients";
import { OidcApplicationPage } from "../components/oidc-application-page";

const base: OidcClient = {
  id: "row-1",
  tenant_id: "t-1",
  client_id: "qci_app",
  name: "Acme portal",
  type: "public",
  redirect_uris: ["https://app.example.com/cb"],
  grant_types: ["authorization_code"],
  scopes: ["openid"],
  created_at: "2026-10-01T00:00:00Z",
};

let stored: OidcClient;
let updates: UpdateOidcInput[];

beforeEach(() => {
  updates = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1/oidc/clients" && !options?.method) return { items: [stored] };
    if (path === "/v1/tenants/t-1/oidc/clients/row-1" && options?.method === "PATCH") {
      const body = options.body as UpdateOidcInput;
      updates.push(body);
      stored = { ...stored, ...body };
      return stored;
    }
    if (path === "/v1/tenants/t-1/oidc/clients/row-1/auth-failures") {
      return { locked_until: null, items: [] };
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});
afterEach(cleanup);

function renderPage(client: OidcClient) {
  stored = client;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <SensitiveActionProvider>
        <OidcApplicationPage clientId="qci_app" />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

describe("An application's logo and home page", () => {
  it("shows the logo and the home page's host, as the hosted sign-in page will", async () => {
    const { container } = renderPage({
      ...base,
      logo_uri: "https://cdn.example.com/acme.svg",
      client_uri: "https://app.example.com/start",
    });

    const home = await screen.findByRole("link", { name: "app.example.com" });
    expect(home.getAttribute("href")).toBe("https://app.example.com/start");
    expect(home.getAttribute("rel")).toBe("noreferrer");
    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
    // jsdom loads no image, so the logo's fallback says it couldn't be shown.
    expect(await screen.findByText("The logo couldn't be loaded.")).toBeTruthy();
  });

  it("shows neither when there are none, nor a logo that isn't https", async () => {
    const { container } = renderPage({
      ...base,
      logo_uri: "http://cdn.example.com/acme.svg",
      client_uri: "",
    });

    await screen.findByText("Acme portal");
    expect(container.querySelector('[data-slot="avatar"]')).toBeNull();
    expect(screen.queryByRole("link", { name: /example\.com/ })).toBeNull();
  });

  it("sets, changes and clears them, round-tripping through the client reads", async () => {
    renderPage(base);
    const logo = await screen.findByLabelText(/^Logo URL/);
    const home = screen.getByLabelText(/^Home page/);
    expect((logo as HTMLInputElement).value).toBe("");

    fireEvent.change(logo, { target: { value: " https://cdn.example.com/acme.svg " } });
    fireEvent.change(home, { target: { value: "https://app.example.com" } });
    save();
    expect(await screen.findByRole("link", { name: "app.example.com" })).toBeTruthy();
    expect(updates.at(-1)).toMatchObject({
      logo_uri: "https://cdn.example.com/acme.svg",
      client_uri: "https://app.example.com",
    });

    fireEvent.change(home, { target: { value: "https://www.example.com/" } });
    save();
    expect(await screen.findByRole("link", { name: "www.example.com" })).toBeTruthy();

    fireEvent.change(logo, { target: { value: "" } });
    fireEvent.change(home, { target: { value: "" } });
    save();
    await waitFor(() => expect(screen.queryByRole("link", { name: /example\.com/ })).toBeNull());
    expect(updates.at(-1)).toMatchObject({ logo_uri: "", client_uri: "" });
    expect(updates).toHaveLength(3);
  });

  it("refuses an http or malformed address with a clear message, sending nothing", async () => {
    renderPage(base);

    fireEvent.change(await screen.findByLabelText(/^Home page/), {
      target: { value: "http://app.example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Logo URL/), {
      target: { value: "cdn.example.com/acme.svg" },
    });
    save();

    expect(
      await screen.findByText("Use an https:// address: http and other schemes aren't accepted."),
    ).toBeTruthy();
    expect(screen.getByText("Enter a full address, such as https://app.example.com.")).toBeTruthy();
    expect(updates).toHaveLength(0);
  });
});
