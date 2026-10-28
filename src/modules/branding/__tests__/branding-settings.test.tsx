// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

import type { LoginDomainStatus } from "@/modules/organizations";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  canRead: true,
  canWrite: true,
  canReadDomains: true,
  canReadBilling: true,
  brandingFeature: true,
  loginDomain: undefined as LoginDomainStatus | undefined,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (permission: string) =>
      ({
        "tenant.read": context.canRead,
        "branding.write": context.canWrite,
        "connection.read": context.canReadDomains,
        "billing.read": context.canReadBilling,
      })[permission] ?? false,
  }),
}));
vi.mock("@/modules/billing", () => ({
  useEntitlements: (enabled: boolean) => ({
    data: enabled
      ? { plan: "pro", features: { custom_branding: context.brandingFeature }, limits: {} }
      : undefined,
    isPending: false,
  }),
}));
vi.mock("@/modules/organizations", () => ({
  orgQueries: {
    list: () => ({
      queryKey: ["orgs", "list"],
      queryFn: async () => ({ items: [{ id: "tenant-a", name: "Example Org" }] }),
    }),
  },
  useLoginDomain: () => ({ data: context.loginDomain, isError: false }),
}));
vi.mock("@/modules/dashboard", () => ({ PageBreadcrumb: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children?: ReactNode }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

import {
  type Branding,
  brandingContrast,
  brandingForeground,
  brandingWith,
  brandLogoSource,
  normalizeBrandColor,
  validBrandLogo,
} from "../branding-model";
import { BrandingSettingsPage } from "../components/branding-settings-page";

const LOGO = "data:image/svg+xml;base64,PHN2Zy8+";

function brandingFixture(): Branding {
  return {
    tenant_id: "tenant-a",
    logo_url: LOGO,
    primary_color: "#f26d0e",
    secondary_color: "#d85301",
    custom_domain: null,
    email_from_name: "Example Group",
    email_from_address: "accounts@example.test",
    settings: {
      background_color: "#fff8f2",
      email_reply_to: "support@example.test",
      custom_footer: "Existing footer",
    },
  };
}

let stored: Branding;

beforeEach(() => {
  Object.assign(context, {
    tenantId: "tenant-a",
    canRead: true,
    canWrite: true,
    canReadDomains: true,
    canReadBilling: true,
    brandingFeature: true,
    loginDomain: undefined,
  });
  stored = brandingFixture();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path.endsWith("/branding")) {
      if (options?.method === "PUT") stored = options.body as Branding;
      return { ...stored, tenant_id: context.tenantId };
    }
    throw new Error(`Unexpected mocked request ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage(onDirtyChange?: (changed: boolean) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <BrandingSettingsPage onDirtyChange={onDirtyChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const puts = () => vi.mocked(api).mock.calls.filter(([, options]) => options?.method === "PUT");
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const frame = () => document.querySelector<HTMLElement>(".brand-frame");

async function changeColour(index: number) {
  await screen.findByText("#F26D0E");
  fireEvent.click(screen.getAllByRole("button", { name: "Change" })[index] as HTMLElement);
}

describe("Branding model", () => {
  it("changes one value and sends the rest of the record back as stored", () => {
    expect(brandingWith(brandingFixture(), { primary_color: " #C2410C " })).toEqual({
      ...brandingFixture(),
      primary_color: "#c2410c",
    });
    expect(brandingWith(brandingFixture(), { primary_color: null }).primary_color).toBeNull();
  });

  it("keeps every other setting when the background or reply-to changes", () => {
    const next = brandingWith(brandingFixture(), {
      background_color: "#FFF",
      email_reply_to: " help@example.test ",
    });
    expect(next.settings).toEqual({
      background_color: "#ffffff",
      email_reply_to: "help@example.test",
      custom_footer: "Existing footer",
    });
    expect(next.secondary_color).toBe("#d85301");
    expect(brandingWith(brandingFixture(), { background_color: null }).settings).toMatchObject({
      background_color: "",
    });
  });

  it("chooses the sign-in page's label colour by WCAG contrast", () => {
    expect(brandingForeground("#ffffff")).toBe("#0a0a0a");
    expect(brandingForeground("#1d4ed8")).toBe("#ffffff");
    expect(brandingContrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(normalizeBrandColor("#ABC")).toBe("#aabbcc");
    expect(normalizeBrandColor("orange")).toBeNull();
  });

  it("accepts only safe logo sources and names them", () => {
    expect(validBrandLogo("https://example.test/logo.svg")).toBe(true);
    expect(validBrandLogo("https://user:pass@example.test/logo.svg")).toBe(false);
    expect(validBrandLogo("javascript:alert(1)")).toBe(false);
    expect(validBrandLogo("data:text/html;base64,PGI+")).toBe(false);
    expect(brandLogoSource(LOGO)).toEqual({ kind: "file", type: "svg" });
    expect(brandLogoSource("https://cdn.example.test/a.png")).toEqual({
      kind: "url",
      host: "cdn.example.test",
    });
  });
});

describe("Branding page", () => {
  it("shows each value where it's changed, and the sign-in page with them", async () => {
    renderPage();
    expect(await screen.findByText("Example Org logo")).toBeTruthy();
    expect(screen.getByText("SVG file")).toBeTruthy();
    expect(screen.getByText(/Emails show a logo only from a web address/)).toBeTruthy();
    expect(screen.getByText("#F26D0E")).toBeTruthy();
    expect(screen.getByText("#FFF8F2")).toBeTruthy();
    expect(screen.queryByText("#D85301")).toBeNull();
    expect(screen.getByText("Links in #F26D0E are hard to read on white")).toBeTruthy();
    expect(screen.getAllByText("accounts.id.qeet.in").length).toBeGreaterThan(0);
    expect(screen.getByText("Example Group")).toBeTruthy();
    expect(screen.getByText("support@example.test")).toBeTruthy();
    expect(frame()?.style.getPropertyValue("--brand-preview")).toBe("#f26d0e");
    expect(frame()?.style.getPropertyValue("--brand-preview-page")).toBe("#fff8f2");
  });

  it("changes the brand colour in place; the preview and contrast follow before it's saved", async () => {
    const dirty = vi.fn();
    renderPage(dirty);
    await changeColour(0);
    fireEvent.change(screen.getByRole("textbox", { name: "Brand colour" }), {
      target: { value: "#C2410C" },
    });
    expect(frame()?.style.getPropertyValue("--brand-preview")).toBe("#c2410c");
    expect(screen.getByText(/Links in #C2410C reach 5\.\d:1 on white/)).toBeTruthy();
    expect(dirty).toHaveBeenLastCalledWith(true);
    expect(puts()).toHaveLength(0);
    fireEvent.click(button("Save"));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]?.[0]).toBe("/v1/tenants/tenant-a/branding");
    expect(puts()[0]?.[1]?.body).toEqual({ ...brandingFixture(), primary_color: "#c2410c" });
    expect(await screen.findByText("#C2410C")).toBeTruthy();
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  it("rejects a colour that isn't a hex value without sending it", async () => {
    renderPage();
    await changeColour(1);
    fireEvent.change(screen.getByRole("textbox", { name: "Page background" }), {
      target: { value: "beige" },
    });
    fireEvent.click(button("Save"));
    expect(await screen.findByText("Enter a hex colour, such as #F26D0E.")).toBeTruthy();
    expect(puts()).toHaveLength(0);
  });

  it("puts the background back to automatic", async () => {
    renderPage();
    await changeColour(1);
    fireEvent.click(button("Use automatic"));
    fireEvent.click(button("Save"));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect((puts()[0]?.[1]?.body as Branding | undefined)?.settings).toMatchObject({
      background_color: "",
      custom_footer: "Existing footer",
    });
  });

  it("edits the email sender and keeps the address that isn't used", async () => {
    renderPage();
    await screen.findByText("Example Group");
    fireEvent.click(button("Edit"));
    const replyTo = await screen.findByRole("textbox", { name: /^Reply-to/ });
    fireEvent.change(replyTo, { target: { value: "not an address" } });
    fireEvent.click(button("Save"));
    expect(await screen.findByText("Enter one email address.")).toBeTruthy();
    expect(puts()).toHaveLength(0);
    fireEvent.change(replyTo, { target: { value: "help@example.test" } });
    fireEvent.change(screen.getByRole("textbox", { name: "From name" }), {
      target: { value: "Example Identity" },
    });
    fireEvent.click(button("Save"));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]?.[1]?.body).toMatchObject({
      email_from_name: "Example Identity",
      email_from_address: "accounts@example.test",
      settings: { email_reply_to: "help@example.test", background_color: "#fff8f2" },
    });
  });

  it("removes the logo only after the confirmation", async () => {
    renderPage();
    await screen.findByText("Example Org logo");
    fireEvent.click(button("Remove"));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/The sign-in page shows the Qeet logo instead/)).toBeTruthy();
    expect(puts()).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove logo" }));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]?.[1]?.body).toMatchObject({ logo_url: null, primary_color: "#f26d0e" });
    expect(await screen.findByText("No logo")).toBeTruthy();
  });

  it("shows a live own sign-in address, and Domains for changing it", async () => {
    stored = { ...brandingFixture(), custom_domain: "login.example.test" };
    context.loginDomain = {
      login_domain: "login.example.test",
      status: "active",
      dns_verified: true,
      dns_detail: "",
      tls_state: "issued",
      tls_detail: "",
      endpoint_state: "live",
      records: [],
    };
    renderPage();
    expect(await screen.findByText("Live")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Manage" }).getAttribute("href")).toBe(
      "/settings/organization/domains",
    );
    expect(document.querySelector(".brand-frame-bar")?.textContent).toBe("login.example.test");
  });

  it("says a plan without branding can't save it, and offers nothing to change", async () => {
    context.brandingFeature = false;
    renderPage();
    expect(await screen.findByText("Branding comes with Starter and above")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Compare plans" }).getAttribute("href")).toBe(
      "/settings/billing",
    );
    for (const action of screen.getAllByRole("button", { name: /^(Change|Replace|Remove|Edit)$/ }))
      expect(action.getAttribute("aria-disabled")).toBe("true");
  });

  it("doesn't request or show branding without read access", async () => {
    context.canRead = false;
    renderPage();
    expect(await screen.findByText("Branding couldn't be loaded")).toBeTruthy();
    expect(
      vi.mocked(api).mock.calls.filter(([path]) => String(path).endsWith("/branding")),
    ).toHaveLength(0);
  });

  it("keeps the change open when the save fails, and says why", async () => {
    renderPage();
    await changeColour(0);
    vi.mocked(api).mockRejectedValueOnce(new Error("Network down"));
    fireEvent.change(screen.getByRole("textbox", { name: "Brand colour" }), {
      target: { value: "#C2410C" },
    });
    fireEvent.click(button("Save"));
    expect(await screen.findByText("That change wasn't saved")).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Brand colour" }).value).toBe(
      "#C2410C",
    );
  });
});
