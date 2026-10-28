// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  canRead: true,
  canWrite: true,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => context.tenantId,
  useMe: () => ({ data: { id: "u1", email: "priya@example.test", display_name: "Priya" } }),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (capability: string) =>
      capability === "billing.read" ? context.canRead : context.canWrite,
  }),
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
import * as dataExport from "@/shared/utils/data-export";
import {
  type BillingProfile,
  type Entitlements,
  formatMoney,
  type Invoice,
  type Plan,
  type Subscription,
  usePlanName,
} from "../api/billing";
import { billingDay, billingPeriod, taxLines } from "../billing-format";
import {
  billingTaxIdValid,
  billingUsage,
  checkoutCountry,
  EMPTY_BILLING_PROFILE,
  isCurrentOffer,
  normalizeBillingProfile,
  overFreeLimits,
  planState,
} from "../billing-model";
import { BillingSettingsPage } from "../components/billing-page";
import { planOffers } from "../plan-offers";

type Fixtures = {
  subscription: Subscription;
  entitlements: Entitlements;
  usage: Record<string, number>;
  profile: BillingProfile;
  invoices: Invoice[];
};
let fixtures: Fixtures;
// The period end, as the page writes it in the test's locale.
const END = billingDay("2026-11-18T09:00:00Z");

function catalogue(): Plan[] {
  return [
    { code: "free", amount: 0 },
    { code: "starter", amount: 240000 },
    { code: "starter_year", amount: 2400000 },
    { code: "pro", amount: 800000 },
    { code: "pro_year", amount: 8000000 },
    { code: "enterprise", amount: 2490000 },
  ].map(({ code, amount }) => ({
    id: code,
    code,
    name: (code.split("_")[0] ?? "").replace(/^./, (c) => c.toUpperCase()),
    description: `Catalogue description for ${code}`,
    interval: code.endsWith("_year") ? "year" : "month",
    prices: { INR: amount, USD: amount / 100 },
    features: [`Catalogue feature for ${code}`],
  }));
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    plan_code: "pro",
    plan_name: "Pro",
    currency: "INR",
    amount_minor: 800000,
    interval: "month",
    status: "active",
    current_period_start: "2026-10-18T09:00:00Z",
    current_period_end: "2026-11-18T09:00:00Z",
    cancel_at_period_end: false,
    trial_end: null,
    ...overrides,
  };
}

function invoice(index: number, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: `${index}c10217f-bfce-4023-9da3-ccd45b62ae2c`,
    plan_code: "pro",
    currency: "INR",
    amount_minor: 944000,
    taxable_amount_minor: 800000,
    tax_amount_minor: 144000,
    tax_rate_bps: 1800,
    tax_type: "gst_igst",
    place_of_supply: "Maharashtra",
    status: "paid",
    period_start: `2026-0${9 - index}-18T09:00:00Z`,
    period_end: `2026-${String(10 - index).padStart(2, "0")}-18T09:00:00Z`,
    issued_at: `2026-0${9 - index}-18T09:00:00Z`,
    ...overrides,
  };
}

beforeEach(() => {
  context.tenantId = "tenant-a";
  context.canRead = true;
  context.canWrite = true;
  fixtures = {
    subscription: subscription(),
    entitlements: {
      plan: "pro",
      features: {},
      limits: { seats: -1, apps: -1, api_keys: -1, custom_roles: -1 },
    },
    usage: { seats: 12, apps: 4, api_keys: 3, custom_roles: 5 },
    profile: {
      ...EMPTY_BILLING_PROFILE,
      legal_name: "Example Ltd",
      billing_email: "billing@example.test",
      address_line1: "4th Floor, 80 Feet Road",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560034",
      country: "IN",
      tax_id_type: "gstin",
      tax_id: "29ABCDE1234F1Z5",
    },
    invoices: [invoice(1), invoice(2, { status: "open" })],
  };
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/billing/plans") return { items: catalogue() };
    if (path === "/v1/tenants")
      return {
        items: [
          { id: "tenant-a", name: "Example Org" },
          { id: "tenant-b", name: "Other Org" },
        ],
      };
    if (path.endsWith("/checkout")) return { status: "active" };
    if (path.endsWith("/subscription/cancel")) return { cancel_at_period_end: true };
    if (path.endsWith("/trial")) return { ...fixtures.subscription, status: "trialing" };
    if (path.endsWith("/subscription")) return fixtures.subscription;
    if (path.endsWith("/entitlements")) return fixtures.entitlements;
    if (path.endsWith("/entitlements/usage")) return { usage: fixtures.usage };
    if (path.endsWith("/profile"))
      return options?.method === "PUT"
        ? options.body
        : {
            ...fixtures.profile,
            legal_name: path.includes("tenant-b") ? "Other Ltd" : fixtures.profile.legal_name,
          };
    if (path.endsWith("/invoices")) return { items: fixtures.invoices };
    throw new Error(`Unexpected mocked request ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage(props: ComponentProps<typeof BillingSettingsPage> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <BillingSettingsPage {...props} />
      </SensitiveActionProvider>
    </QueryClientProvider>
  );
  return { ...render(tree()), client, tree };
}

const calls = (suffix: string) =>
  vi.mocked(api).mock.calls.filter(([path]) => String(path).endsWith(suffix));
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const dialog = () => screen.getByRole("alertdialog");

async function openChangePlan() {
  fireEvent.click(await screen.findByRole("button", { name: "Change plan" }));
  await screen.findByRole("radiogroup", { name: "Plan" });
}

describe("Billing catalogue", () => {
  it("formats zero-, two- and three-decimal currencies without assuming cents", () => {
    expect(formatMoney(1234, "JPY")).toContain("1,234");
    expect(formatMoney(1234, "USD")).toContain("12.34");
    expect(formatMoney(1234, "BHD")).toContain("1.234");
  });

  it("prices each cycle from its own plan and never bills a monthly price under an annual code", () => {
    const yearly = planOffers(catalogue(), "year", "INR");
    expect(yearly.find((offer) => offer.tier === "pro")).toMatchObject({
      planCode: "pro_year",
      price: 8000000,
      yearly: { percent: 17 },
    });
    expect(yearly.find((offer) => offer.tier === "enterprise")).toMatchObject({
      contactSales: true,
      price: undefined,
    });
    const noAnnual = catalogue().filter((plan) => plan.code !== "starter_year");
    expect(planOffers(noAnnual, "year", "INR").find((o) => o.tier === "starter")).toMatchObject({
      unavailable: true,
      price: undefined,
    });
  });

  it("counts only the same plan, currency and live subscription as the current choice", () => {
    const pro = planOffers(catalogue(), "month", "INR").find((offer) => offer.tier === "pro");
    const proYear = planOffers(catalogue(), "year", "INR").find((offer) => offer.tier === "pro");
    assertDefined(pro);
    assertDefined(proYear);
    expect(isCurrentOffer(pro, subscription(), "INR")).toBe(true);
    expect(isCurrentOffer(pro, subscription(), "USD")).toBe(false);
    expect(isCurrentOffer(proYear, subscription(), "INR")).toBe(false);
    expect(isCurrentOffer(pro, subscription({ cancel_at_period_end: true }), "INR")).toBe(false);
    expect(isCurrentOffer(pro, subscription({ status: "trialing" }), "INR")).toBe(false);
  });

  it("names the subscription's state from the server and the clock", () => {
    expect(planState(subscription())).toBe("active");
    expect(planState(subscription({ cancel_at_period_end: true }))).toBe("ending");
    expect(planState(subscription({ plan_code: "free", amount_minor: 0 }))).toBe("free");
    expect(planState({ ...subscription(), status: "none" })).toBe("none");
    const trial = subscription({ status: "trialing", trial_end: "2026-11-01T00:00:00Z" });
    expect(planState(trial, Date.parse("2026-10-30T00:00:00Z"))).toBe("trial");
    expect(planState(trial, Date.parse("2026-11-02T00:00:00Z"))).toBe("trialEnded");
    expect(planState(subscription({ status: "past_due" }))).toBe("other");
  });

  it("uses the saved billing country for payment routing, else the currency's", () => {
    expect(checkoutCountry("USD", { ...EMPTY_BILLING_PROFILE, country: "in" })).toBe("IN");
    expect(checkoutCountry("GBP")).toBe("GB");
  });

  it("normalizes tax details without claiming they're verified", () => {
    const profile = { ...EMPTY_BILLING_PROFILE, tax_id_type: "gstin" as const, tax_id: " 29abc " };
    expect(billingTaxIdValid(profile)).toBe(false);
    expect(billingTaxIdValid({ ...profile, tax_id: "29ABCDE1234F1Z5" })).toBe(true);
    expect(normalizeBillingProfile({ ...profile, tax_id: " 29abcde1234f1z5 " }).tax_id).toBe(
      "29ABCDE1234F1Z5",
    );
    expect(normalizeBillingProfile({ ...profile, tax_id_type: "none" }).tax_id).toBe("");
  });

  it("splits intra-state GST into CGST and SGST halves, and keeps IGST whole", () => {
    expect(taxLines(invoice(1, { tax_type: "gst_cgst_sgst", tax_amount_minor: 448201 }))).toEqual([
      { kind: "cgst", rate: 9, amount: 224100 },
      { kind: "sgst", rate: 9, amount: 224101 },
    ]);
    expect(taxLines(invoice(1))).toEqual([{ kind: "igst", rate: 18, amount: 144000 }]);
    expect(taxLines(invoice(1, { tax_type: "gst_zero_rated", tax_amount_minor: 0 }))).toEqual([]);
  });

  it("writes a period with its year once", () => {
    expect(
      billingPeriod("2026-10-18T09:00:00Z", "2026-11-18T09:00:00Z", "en-IN").replace(/\s/g, " "),
    ).toBe("18 Oct – 18 Nov 2026");
  });
});

describe("Billing usage", () => {
  it("doesn't turn unavailable counts or caps into zero usage or unlimited access", () => {
    expect(billingUsage(undefined, 5)).toMatchObject({ used: null, percent: null });
    expect(billingUsage(3, undefined)).toMatchObject({ limit: null, unlimited: false });
    expect(billingUsage(-1, 5).used).toBeNull();
  });

  it("handles zero caps, unlimited plans, a full cap and an exceeded one", () => {
    expect(billingUsage(0, 0)).toMatchObject({ percent: 0, exceeded: false });
    expect(billingUsage(2, 0)).toMatchObject({ percent: 100, exceeded: true });
    expect(billingUsage(99, -1)).toMatchObject({ unlimited: true, percent: null });
    expect(billingUsage(2, 2)).toMatchObject({ atLimit: true, exceeded: false });
    expect(billingUsage(6, 5)).toMatchObject({ exceeded: true, percent: 100 });
    expect(overFreeLimits({ seats: 12, apps: 3, api_keys: 2, custom_roles: 1 })).toEqual([
      { resource: "seats", used: 12, limit: 5 },
      { resource: "custom_roles", used: 1, limit: 0 },
    ]);
  });
});

describe("Plan names", () => {
  it("names a plan from the catalogue and reads an unknown or unloaded code as words", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePlanName(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current("pro_year")).toBe("Pro Year");
    await waitFor(() => expect(result.current("pro")).toBe("Pro"));
    expect(result.current("business_plus")).toBe("Business Plus");
  });
});

describe("Billing page", () => {
  it("says what the organisation pays and until when, with usage and its details", async () => {
    renderPage();
    expect(
      await screen.findByText("What Example Org pays for Qeet ID, and the invoices for it."),
    ).toBeTruthy();
    expect(
      await screen.findByText(new RegExp(`₹8,000 a month, before GST · paid until ${END}`)),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Pro has no limits on these. Seats are people with a role, plus pending invitations.",
      ),
    ).toBeTruthy();
    expect(await screen.findByText("Example Ltd")).toBeTruthy();
    expect(screen.getByText("29ABCDE1234F1Z5")).toBeTruthy();
    expect(screen.getByText("Collected at checkout")).toBeTruthy();
  });

  it("meters each capped resource and marks the ones at their cap", async () => {
    fixtures.subscription = subscription({ plan_code: "free", plan_name: "Free", amount_minor: 0 });
    fixtures.entitlements = {
      plan: "free",
      features: {},
      limits: { seats: 5, apps: 3, api_keys: 2, custom_roles: 0 },
    };
    fixtures.usage = { seats: 3, apps: 1, api_keys: 2, custom_roles: 0 };
    renderPage();
    expect(await screen.findByText("No charge · free for as long as you like")).toBeTruthy();
    expect(await screen.findByRole("meter", { name: "API keys: 2 of 2" })).toBeTruthy();
    expect(screen.getByText("At limit")).toBeTruthy();
    expect(screen.getByText("Not included on Free")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Cancel subscription" })).toBeNull();
  });

  it("confirms the exact plan and keeps checkout's return URLs and the saved country", async () => {
    renderPage();
    await screen.findByText("Example Ltd");
    await openChangePlan();
    expect(screen.getByText("Current plan")).toBeTruthy();
    expect(button("You're on Pro").getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button(/^Yearly/));
    fireEvent.click(screen.getByRole("radio", { name: "Starter" }));
    fireEvent.click(button("Switch to Starter"));
    expect(within(dialog()).getByText(/₹24,000 a year before tax/)).toBeTruthy();
    expect(within(dialog()).getByText(/nothing is credited for what's left of Pro/)).toBeTruthy();
    expect(calls("/checkout")).toHaveLength(0);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Switch to Starter" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/tenants/tenant-a/billing/checkout",
        expect.objectContaining({
          method: "POST",
          body: {
            plan_code: "starter_year",
            currency: "INR",
            country: "IN",
            success_url: `${window.location.origin}/settings/billing?checkout=success`,
            cancel_url: `${window.location.origin}/settings/billing?checkout=cancelled`,
          },
        }),
      ),
    );
  });

  it("warns about the actual overages before a switch to Free", async () => {
    renderPage();
    await screen.findByText("Example Ltd");
    await openChangePlan();
    fireEvent.click(screen.getByRole("radio", { name: "Free" }));
    fireEvent.click(button("Switch to Free"));
    expect(within(dialog()).getByText("Switch to Free with more than it allows?")).toBeTruthy();
    expect(
      within(dialog()).getByText(/You have 12 seats \(Free allows 5\), 4 applications/),
    ).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(calls("/checkout")).toHaveLength(0);
  });

  it("opens the sales form for Enterprise instead of a checkout", async () => {
    renderPage();
    await screen.findByText("Example Ltd");
    await openChangePlan();
    fireEvent.click(screen.getByRole("radio", { name: "Enterprise" }));
    fireEvent.click(button("Talk to sales"));
    const drawer = await screen.findByRole("dialog", { name: "Talk to sales" });
    expect(
      within(drawer).getByRole<HTMLInputElement>("textbox", { name: "Work email" }).value,
    ).toBe("priya@example.test");
    expect(calls("/checkout")).toHaveLength(0);
  });

  it("opens Change plan on a linked plan", async () => {
    renderPage({ recommendedPlan: "starter" });
    await screen.findByRole("radiogroup", { name: "Plan" });
    expect(screen.getByRole("radio", { name: "Starter" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("cancels only after the confirmation, saying what happens", async () => {
    renderPage();
    await screen.findByText("Example Ltd");
    fireEvent.click(button("Cancel subscription"));
    expect(
      within(dialog()).getByText(
        new RegExp(`Pro stays until ${END}, the end of the period paid for`),
      ),
    ).toBeTruthy();
    expect(calls("/subscription/cancel")).toHaveLength(0);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel subscription" }));
    await waitFor(() => expect(calls("/subscription/cancel")).toHaveLength(1));
  });

  it("marks an ending plan and offers no second cancellation", async () => {
    fixtures.subscription = subscription({ cancel_at_period_end: true });
    renderPage();
    expect(await screen.findByText(new RegExp(`· ends ${END}`))).toBeTruthy();
    expect(screen.getByText("Ending")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).toBeNull();
  });

  it("drops a pending plan confirmation after an organisation switch", async () => {
    const view = renderPage();
    await screen.findByText("Example Ltd");
    await openChangePlan();
    fireEvent.click(screen.getByRole("radio", { name: "Starter" }));
    fireEvent.click(button("Switch to Starter"));
    context.tenantId = "tenant-b";
    view.rerender(view.tree());
    await screen.findByText("Other Ltd");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Switch to Starter" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(calls("/checkout")).toHaveLength(0);
  });

  it("offers the Pro trial only to an organisation that never had a subscription", async () => {
    fixtures.subscription = { ...subscription(), status: "none" };
    fixtures.entitlements = { ...fixtures.entitlements, plan: "free" };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Start trial" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/tenants/tenant-a/billing/trial",
        expect.objectContaining({ method: "POST", body: { plan_code: "pro", currency: "INR" } }),
      ),
    );
  });

  it("doesn't request or show tenant billing data without read access", async () => {
    context.canRead = false;
    context.canWrite = false;
    renderPage();
    await screen.findByText("Billing couldn't be loaded");
    expect(
      vi.mocked(api).mock.calls.filter(([path]) => String(path).includes("/v1/tenants/tenant-a")),
    ).toHaveLength(0);
  });

  it("shows the facts but no changes with read access only", async () => {
    context.canWrite = false;
    renderPage();
    await screen.findByText("Example Ltd");
    for (const name of ["Change plan", "Edit", "Cancel subscription"])
      expect(screen.queryByRole("button", { name })).toBeNull();
  });
});

describe("Billing details", () => {
  it("checks the GSTIN, then saves the normalized details once", async () => {
    renderPage();
    await screen.findByText("Example Ltd");
    fireEvent.click(button("Edit"));
    const gstin = await screen.findByRole("textbox", { name: "GSTIN" });
    fireEvent.change(gstin, { target: { value: "29abc" } });
    fireEvent.click(button("Save details"));
    expect(await screen.findByText(/Enter a 15-character GSTIN/)).toBeTruthy();
    const puts = () => calls("/profile").filter(([, options]) => options?.method === "PUT");
    expect(puts()).toHaveLength(0);
    fireEvent.change(gstin, { target: { value: " 27abcde1234f1z5 " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Legal name" }), {
      target: { value: "  Example Private Ltd " },
    });
    fireEvent.click(button("Save details"));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/tenants/tenant-a/billing/profile",
        expect.objectContaining({
          method: "PUT",
          body: expect.objectContaining({
            legal_name: "Example Private Ltd",
            tax_id: "27ABCDE1234F1Z5",
            tax_id_type: "gstin",
          }),
        }),
      ),
    );
    expect(puts()).toHaveLength(1);
    expect(await screen.findByText("Example Private Ltd")).toBeTruthy();
  });

  it("offers to add details when none are saved", async () => {
    fixtures.profile = EMPTY_BILLING_PROFILE;
    renderPage();
    expect(await screen.findByText("No billing details yet")).toBeTruthy();
    fireEvent.click(button("Add details"));
    expect(await screen.findByRole("heading", { name: "Add billing details" })).toBeTruthy();
  });
});

describe("Invoices", () => {
  it("lists them newest first and opens one as the tax invoice reads", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Invoices" });
    await within(table).findByText("1c10217f");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]?.textContent).toContain("1c10217f");
    expect(within(table).getByText("Open")).toBeTruthy();
    // The row's button is named by its whole primary cell (QTRX-21).
    fireEvent.click(within(table).getByRole("button", { name: /^1c10217f/ }));
    const drawer = await screen.findByRole("dialog", { name: "Invoice 1c10217f" });
    expect(within(drawer).getByText("IGST 18%")).toBeTruthy();
    expect(within(drawer).getByText("₹9,440.00")).toBeTruthy();
    expect(within(drawer).getByText("Maharashtra")).toBeTruthy();
  });

  it("exports every invoice", async () => {
    const exportToCsv = vi.spyOn(dataExport, "exportToCsv").mockImplementation(() => {});
    renderPage();
    await screen.findByRole("table", { name: "Invoices" });
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(exportToCsv).toHaveBeenCalledWith(
      "billing-invoices",
      expect.arrayContaining(fixtures.invoices),
      expect.any(Array),
    );
  });

  it("says when there are none", async () => {
    fixtures.invoices = [];
    renderPage();
    expect(await screen.findByText("No invoices yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });
});

function assertDefined<T>(value: T | undefined): asserts value is T {
  if (value === undefined) throw new Error("expected a value");
}
