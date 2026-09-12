// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  canRead: true,
  canWrite: true,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (capability: string) =>
      capability === "billing.read" ? context.canRead : context.canWrite,
  }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import * as dataExport from "@/shared/utils/data-export";
import {
  type BillingProfile,
  formatMoney,
  type Invoice,
  type Plan,
  type Subscription,
} from "../api/billing";
import {
  billingPlanChoices,
  billingSavings,
  billingTaxIdValid,
  billingUsage,
  checkoutCountry,
  EMPTY_BILLING_PROFILE,
  isCurrentBillingChoice,
  normalizeBillingProfile,
} from "../billing-model";
import { BillingDetails, type BillingDetailsProps } from "../components/billing-details";
import { BillingInvoices } from "../components/billing-invoices";
import {
  BillingSettingsPage,
  BillingSettingsView,
  type BillingSettingsViewProps,
} from "../components/billing-page";

beforeEach(() => {
  context.tenantId = "tenant-a";
  context.canRead = true;
  context.canWrite = true;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/billing/plans") return { items: catalogue() };
    if (path.endsWith("/checkout")) return { status: "active" };
    if (path.endsWith("/subscription/cancel")) return { cancel_at_period_end: true };
    if (path.endsWith("/trial")) return { ...subscription(), status: "trialing" };
    if (path.endsWith("/subscription")) return subscription();
    if (path.endsWith("/entitlements")) return viewProps().entitlements;
    if (path.endsWith("/entitlements/usage")) return { usage: viewProps().usage };
    if (path.endsWith("/profile"))
      return options?.method === "PUT"
        ? options.body
        : {
            ...profileFixture(),
            legal_name: path.includes("tenant-b") ? "Other organization" : "Example Ltd",
          };
    if (path.endsWith("/invoices")) return { items: invoiceFixtures() };
    throw new Error(`Unexpected mocked request ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

function profileFixture(): BillingProfile {
  return {
    ...EMPTY_BILLING_PROFILE,
    legal_name: "Example Ltd",
    billing_email: "billing@example.test",
    country: "IN",
    tax_id_type: "gstin",
    tax_id: "29ABCDE1234F1Z5",
  };
}

function invoiceFixtures(): Invoice[] {
  return ["paid", "open"].map((status, index) => ({
    id: `invoice-${status}-fixture`,
    plan_code: "pro",
    currency: "INR",
    amount_minor: 944000,
    taxable_amount_minor: 800000,
    tax_amount_minor: 144000,
    tax_rate_bps: 1800,
    tax_type: "gst_igst",
    place_of_supply: "IN",
    status,
    period_start: `2026-0${8 + index}-01T00:00:00Z`,
    period_end: `2026-0${8 + index}-28T00:00:00Z`,
    issued_at: `2026-0${8 + index}-01T00:00:00Z`,
  }));
}

function detailsProps(): BillingDetailsProps {
  return {
    profile: profileFixture(),
    canWrite: true,
    loading: false,
    error: false,
    fetching: false,
    onRetry: vi.fn(),
    onSave: vi.fn().mockImplementation(async (profile) => profile),
  };
}

async function selectOption(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }), { button: 0 });
  const choice = await screen.findByRole("option", { name: option });
  fireEvent.pointerDown(choice, { pointerType: "mouse", button: 0 });
  fireEvent.click(choice);
}

function renderPage(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  const tree = () => (
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <BillingSettingsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>
  );
  return { ...render(tree()), client, tree };
}

function viewProps(): BillingSettingsViewProps {
  return {
    plans: catalogue(),
    subscription: subscription(),
    entitlements: {
      plan: "pro",
      features: {},
      limits: { seats: -1, apps: -1, api_keys: -1, custom_roles: -1 },
    },
    usage: { seats: 12, apps: 4, api_keys: 3, custom_roles: 5 },
    loading: false,
    subscriptionError: false,
    plansError: false,
    usageLoading: false,
    usageError: false,
    canRead: true,
    canWrite: true,
    fetching: false,
    onRetry: vi.fn(),
    onChangePlan: vi.fn().mockResolvedValue({ status: "active" }),
    onCancel: vi.fn().mockResolvedValue({ cancel_at_period_end: true }),
    onStartTrial: vi.fn().mockResolvedValue(subscription()),
  };
}

function renderView(props = viewProps()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BillingSettingsView {...props} />
    </QueryClientProvider>,
  );
}

function catalogue(): Plan[] {
  return [
    { code: "free", amount: 0 },
    { code: "starter", amount: 240000 },
    { code: "starter_year", amount: 2400000 },
    { code: "pro", amount: 800000 },
    { code: "pro_year", amount: 8000000 },
    { code: "enterprise", amount: 0 },
  ].map(({ code, amount }) => ({
    id: code,
    code,
    name: code[0].toUpperCase() + code.split("_")[0].slice(1),
    description: `Catalogue description for ${code}`,
    interval: code.endsWith("_year") ? "year" : "month",
    prices: { INR: amount, USD: amount / 100 },
    features: [`Catalogue feature for ${code}`],
  }));
}

function subscription(): Subscription {
  return {
    plan_code: "pro",
    plan_name: "Pro",
    currency: "INR",
    amount_minor: 800000,
    interval: "month",
    status: "active",
    current_period_start: "2026-09-01T00:00:00Z",
    current_period_end: "2026-10-01T00:00:00Z",
    cancel_at_period_end: false,
    trial_end: null,
  };
}

describe("Billing catalogue", () => {
  it("formats zero-, two- and three-decimal currencies without assuming cents", () => {
    expect(formatMoney(2400, "JPY")).toMatch(/2,400/);
    expect(formatMoney(2400, "USD")).toMatch(/24\.00/);
    expect(formatMoney(2400, "BHD")).toMatch(/2\.400/);
  });
  it("uses exact monthly and yearly variants, with computed savings", () => {
    const plans = catalogue();
    expect(billingSavings(plans, "INR")).toBe(17);
    const choices = billingPlanChoices(plans, "year", "INR");
    expect(choices.map((choice) => choice.code)).toEqual([
      "free",
      "starter_year",
      "pro_year",
      "enterprise",
    ]);
    expect(choices[2].amount).toBe(8000000);
    expect(choices[2].plan.features).toEqual(["Catalogue feature for pro_year"]);
    expect(choices[3].contactSales).toBe(true);
  });

  it("never bills a monthly fallback under an annual code or missing currency", () => {
    const plans = catalogue().filter((plan) => plan.code !== "pro_year");
    const choice = billingPlanChoices(plans, "year", "INR")[2];
    expect(choice.amount).toBeNull();
    expect(choice.plan.features).toEqual(["Catalogue feature for pro"]);
    expect(billingPlanChoices(plans, "month", "EUR")[1].amount).toBeNull();
    expect(billingSavings(plans, "INR")).toBe(0);
  });

  it("allows interval and currency changes without marking them as the current subscription", () => {
    const current = subscription();
    const month = billingPlanChoices(catalogue(), "month", "INR")[2];
    const year = billingPlanChoices(catalogue(), "year", "INR")[2];
    expect(isCurrentBillingChoice(month, current, "INR")).toBe(true);
    expect(isCurrentBillingChoice(year, current, "INR")).toBe(false);
    expect(isCurrentBillingChoice(month, current, "USD")).toBe(false);
    expect(isCurrentBillingChoice(month, { ...current, status: "trialing" }, "INR")).toBe(false);
    expect(isCurrentBillingChoice(month, { ...current, cancel_at_period_end: true }, "INR")).toBe(
      false,
    );
    expect(isCurrentBillingChoice(month, { ...current, status: "cancelled" }, "INR")).toBe(false);
    expect(current.amount_minor).toBe(800000);
  });

  it("uses the saved billing country for payment routing", () => {
    expect(checkoutCountry("USD", { ...EMPTY_BILLING_PROFILE, country: " in " })).toBe("IN");
    expect(checkoutCountry("INR")).toBe("IN");
  });

  it("normalizes tax profile data without claiming tax verification", () => {
    const profile = {
      ...EMPTY_BILLING_PROFILE,
      legal_name: " Example Ltd ",
      tax_id_type: "gstin" as const,
      tax_id: " 29abcde1234f1z5 ",
      country: "in",
    };
    expect(billingTaxIdValid(profile)).toBe(true);
    expect(normalizeBillingProfile(profile)).toMatchObject({
      legal_name: "Example Ltd",
      tax_id: "29ABCDE1234F1Z5",
      country: "IN",
    });
    expect(billingTaxIdValid({ ...profile, tax_id: "invalid" })).toBe(false);
    expect(normalizeBillingProfile({ ...profile, tax_id_type: "none" }).tax_id).toBe("");
  });
});

describe("Billing profile and invoices", () => {
  it.each(["light", "dark"])("uses explicit invoice chip and dot colors in %s mode", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const cases = [
      { status: "paid", label: "Paid", dot: "bg-success", surface: "bg-success/10" },
      { status: "PAID", label: "Paid", dot: "bg-success", surface: "bg-success/10" },
      { status: "open", label: "Open", dot: "bg-warning", surface: "bg-warning/10" },
      { status: "pending", label: "Pending", dot: "bg-warning", surface: "bg-warning/10" },
      { status: "failed", label: "Failed", dot: "bg-destructive", surface: "bg-destructive/10" },
      {
        status: "uncollectible",
        label: "Uncollectible",
        dot: "bg-destructive",
        surface: "bg-destructive/10",
      },
      { status: "refunded", label: "Refunded", dot: "bg-info", surface: "bg-info/10" },
      { status: "draft", label: "Draft", dot: "bg-muted-foreground/60", surface: "bg-muted" },
      { status: "void", label: "Void", dot: "bg-muted-foreground/60", surface: "bg-muted" },
      {
        status: "unknown",
        label: "Status unavailable",
        dot: "bg-muted-foreground/60",
        surface: "text-foreground",
      },
    ];
    const invoices = cases.map(({ status }, index) => ({
      ...invoiceFixtures()[0],
      id: `invoice-status-${index}`,
      status,
    }));
    render(
      <BillingInvoices
        invoices={invoices}
        plans={catalogue()}
        loading={false}
        error={false}
        fetching={false}
        onRetry={vi.fn()}
      />,
    );

    for (const [index, expected] of cases.entries()) {
      const row = screen
        .getByRole("button", { name: `View invoice invoice-status-${index}` })
        .closest("tr");
      if (!row) throw new Error("Invoice row not found");
      const chip = within(row).getByText(expected.label, { exact: true });
      const dot = chip.querySelector('[data-slot="status-pill-dot"]');
      expect(dot?.classList.contains(expected.dot)).toBe(true);
      expect(chip.classList.contains(expected.surface)).toBe(true);
      expect(dot?.getAttribute("aria-hidden")).toBe("true");
    }

    fireEvent.click(screen.getByRole("button", { name: "View invoice invoice-status-0" }));
    const paid = within(screen.getByRole("dialog")).getByText("Paid", { exact: true });
    expect(
      paid.querySelector('[data-slot="status-pill-dot"]')?.classList.contains("bg-success"),
    ).toBe(true);
  });

  it.each(["light", "dark"])(
    "keeps lower sections in the same order in %s mode without invented cards or verification",
    (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      const { container } = render(
        <>
          <BillingDetails {...detailsProps()} />
          <BillingInvoices
            invoices={invoiceFixtures()}
            plans={catalogue()}
            loading={false}
            error={false}
            fetching={false}
            onRetry={vi.fn()}
          />
        </>,
      );
      expect(
        screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
      ).toEqual(["Billing profile", "Payment method", "Tax & compliance", "Invoices"]);
      expect(screen.getByText("No payment method information available.")).toBeTruthy();
      expect(screen.queryByText(/4242|4589|Verified|Download PDF/)).toBeNull();
      expect(screen.getByText("Tax ID provided")).toBeTruthy();
      for (const element of container.querySelectorAll("[class]"))
        expect(element.getAttribute("class")).not.toMatch(
          /\bdark:(hidden|block|grid|flex|order-|p[xy]-|m[xy]-)/,
        );
    },
  );

  it("validates GSTIN and saves the normalized profile exactly once", async () => {
    const props = detailsProps();
    render(<BillingDetails {...props} />);
    fireEvent.change(screen.getByLabelText("GSTIN"), { target: { value: "bad" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByText("Enter a valid 15-character GSTIN.")).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("GSTIN"), { target: { value: "29abcde1234f1z5" } });
    fireEvent.change(screen.getByLabelText("Legal / business name"), {
      target: { value: " Updated Ltd " },
    });
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("Billing details saved");
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ legal_name: "Updated Ltd", tax_id: "29ABCDE1234F1Z5" }),
    );
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("retains dirty profile edits on refetch and resets to the latest saved values", () => {
    const props = detailsProps();
    const view = render(<BillingDetails {...props} />);
    fireEvent.change(screen.getByLabelText("Legal / business name"), {
      target: { value: "Unsaved edit" },
    });
    view.rerender(
      <BillingDetails
        {...props}
        profile={{ ...profileFixture(), legal_name: "New server value" }}
      />,
    );
    expect((screen.getByLabelText("Legal / business name") as HTMLInputElement).value).toBe(
      "Unsaved edit",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect((screen.getByLabelText("Legal / business name") as HTMLInputElement).value).toBe(
      "New server value",
    );
  });

  it("clears a removed tax ID and disables all read-only fields", async () => {
    const props = detailsProps();
    const view = render(<BillingDetails {...props} />);
    await selectOption("Tax ID type", "None");
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() =>
      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ tax_id_type: "none", tax_id: "" }),
      ),
    );
    view.unmount();
    render(<BillingDetails {...props} canWrite={false} />);
    expect(screen.getByLabelText("Legal / business name").matches(":disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Legal / business name"), {
      target: { value: "Blocked" },
    });
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("retains unsaved data on a failed save without exposing server messages", async () => {
    const props = detailsProps();
    props.onSave = vi.fn().mockRejectedValue(new Error("database connection string private"));
    render(<BillingDetails {...props} />);
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Bengaluru" } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("alert");
    expect(screen.queryByText(/database connection string private/)).toBeNull();
    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("Bengaluru");
  });

  it("filters invoices, opens real details and exports the filtered records", async () => {
    const exportSpy = vi.spyOn(dataExport, "exportToCsv").mockImplementation(() => {});
    render(
      <BillingInvoices
        invoices={invoiceFixtures()}
        plans={catalogue()}
        loading={false}
        error={false}
        fetching={false}
        onRetry={vi.fn()}
      />,
    );
    await selectOption("Invoice status", "Paid");
    expect(screen.queryByRole("button", { name: "View invoice invoice-open-fixture" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(exportSpy).toHaveBeenCalledWith(
      "billing-invoices",
      [invoiceFixtures()[0]],
      expect.any(Array),
    );
    fireEvent.click(screen.getByRole("button", { name: "View invoice invoice-paid-fixture" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("invoice-paid-fixture")).toBeTruthy();
    expect(within(dialog).getByText("IN")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Download CSV" }));
    expect(exportSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps failed invoices and profile data hidden instead of displaying cached details", () => {
    render(
      <>
        <BillingDetails {...detailsProps()} error />
        <BillingInvoices
          invoices={invoiceFixtures()}
          plans={catalogue()}
          loading={false}
          error
          fetching={false}
          onRetry={vi.fn()}
        />
      </>,
    );
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("button", { name: "View invoice invoice-paid-fixture" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("Billing API orchestration", () => {
  it("confirms the exact plan and preserves checkout return URLs and saved country routing", async () => {
    renderPage();
    await screen.findByDisplayValue("Example Ltd");
    fireEvent.click(screen.getByRole("button", { name: /Yearly/ }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to Starter" }));
    expect(vi.mocked(api).mock.calls.filter(([path]) => path.endsWith("/checkout"))).toHaveLength(
      0,
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Switch to Starter" }),
    );
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

  it("warns about actual resource overages before a Free downgrade", async () => {
    renderPage();
    await screen.findByDisplayValue("Example Ltd");
    fireEvent.click(screen.getByRole("button", { name: "Switch to Free" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Members \(12\/5\)/)).toBeTruthy();
    expect(within(dialog).getByText(/Custom roles \(5\/0\)/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(vi.mocked(api).mock.calls.filter(([path]) => path.endsWith("/checkout"))).toHaveLength(
      0,
    );
  });

  it("confirms cancellation and sends it only after confirmation", async () => {
    renderPage();
    await screen.findByDisplayValue("Example Ltd");
    fireEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
    expect(
      vi.mocked(api).mock.calls.filter(([path]) => path.endsWith("/subscription/cancel")),
    ).toHaveLength(0);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel subscription" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/billing/subscription/cancel", {
        method: "POST",
      }),
    );
  });

  it("cancels a pending checkout confirmation after an organization switch", async () => {
    const view = renderPage();
    await screen.findByDisplayValue("Example Ltd");
    fireEvent.click(screen.getByRole("button", { name: "Switch to Starter" }));
    context.tenantId = "tenant-b";
    view.rerender(view.tree());
    await screen.findByDisplayValue("Other organization");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Switch to Starter" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(vi.mocked(api).mock.calls.filter(([path]) => path.endsWith("/checkout"))).toHaveLength(
      0,
    );
  });

  it("does not request or render tenant billing data without read permission", async () => {
    context.canRead = false;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["billing", "profile", "tenant-a"], profileFixture());
    client.setQueryData(["billing", "subscription", "tenant-a"], subscription());
    renderPage(client);
    expect(await screen.findByText("You don't have access to billing.")).toBeTruthy();
    expect(screen.queryByDisplayValue("Example Ltd")).toBeNull();
    expect(vi.mocked(api).mock.calls.filter(([path]) => path.includes("/tenants/"))).toHaveLength(
      0,
    );
  });

  it("persists the profile through the authorized scoped endpoint", async () => {
    renderPage();
    await screen.findByDisplayValue("Example Ltd");
    fireEvent.change(screen.getByLabelText("City"), { target: { value: " Bengaluru " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Billing details saved");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/billing/profile", {
      method: "PUT",
      body: { ...profileFixture(), city: "Bengaluru" },
    });
  });
});

describe("Billing usage", () => {
  it("does not turn unavailable counts or caps into zero usage or unlimited access", () => {
    expect(billingUsage()).toEqual({
      used: null,
      limit: null,
      unlimited: false,
      percent: null,
      exceeded: false,
    });
    expect(billingUsage(2).percent).toBeNull();
    expect(billingUsage(undefined, 10).used).toBeNull();
    expect(billingUsage(Number.NaN, -2).limit).toBeNull();
  });

  it("handles zero usage, zero caps, unlimited plans and exceeded limits", () => {
    expect(billingUsage(0, 0)).toMatchObject({ percent: 0, exceeded: false });
    expect(billingUsage(1, 0)).toMatchObject({ percent: 100, exceeded: true });
    expect(billingUsage(20, -1)).toMatchObject({ unlimited: true, percent: null });
    expect(billingUsage(3, 5)).toMatchObject({ percent: 60, exceeded: false });
    expect(billingUsage(6, 5)).toMatchObject({ percent: 100, exceeded: true });
  });
});

describe("Billing layout", () => {
  it("does not mark a cancelled subscription as current or show a future renewal", () => {
    renderView({ ...viewProps(), subscription: { ...subscription(), status: "cancelled" } });
    expect(screen.queryByText("Current", { exact: true })).toBeNull();
    expect(screen.queryByText(/Renews on/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Current plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel plan" })).toBeNull();
  });

  it("blocks a Free downgrade when resource counts are incomplete", () => {
    const props = { ...viewProps(), usage: { seats: 12 } };
    renderView(props);
    const downgrade = screen.getByRole("button", { name: "Switch to Free" });
    expect(downgrade.hasAttribute("disabled")).toBe(true);
    fireEvent.click(downgrade);
    expect(props.onChangePlan).not.toHaveBeenCalled();
  });

  it.each(["light", "dark"])(
    "keeps subscription, usage and plans identical in %s mode",
    (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      const { container } = renderView();
      expect(screen.getByRole("heading", { name: "Billing", level: 1 })).toBeTruthy();
      expect(
        screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
      ).toEqual(["Current plan", "Usage", "Choose your plan"]);
      expect(screen.getByRole("button", { name: "Current plan" }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(screen.getAllByText("/ Unlimited")).toHaveLength(4);
      expect(screen.queryByText("Active users")).toBeNull();
      expect(screen.getAllByText("Catalogue feature for pro")).toHaveLength(2);
      for (const element of container.querySelectorAll("[class]")) {
        expect(element.getAttribute("class")).not.toMatch(
          /\bdark:(hidden|block|grid|flex|order-|p[xy]-|m[xy]-)/,
        );
      }
    },
  );

  it("browses and submits exact yearly pricing without altering the current-plan amount", async () => {
    const props = viewProps();
    renderView(props);
    const current = screen.getByRole("region", { name: "Current plan" });
    const currentText = current.textContent;
    fireEvent.click(screen.getByRole("button", { name: /Yearly/ }));
    expect(current.textContent).toBe(currentText);
    expect(screen.getByText("Catalogue feature for pro_year")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Pro" }));
    await waitFor(() => expect(props.onChangePlan).toHaveBeenCalledTimes(1));
    expect(props.onChangePlan).toHaveBeenCalledWith(
      expect.objectContaining({ code: "pro_year", amount: 8000000 }),
      "INR",
    );
  });

  it("disables checkout when the yearly variant is missing", () => {
    const props = viewProps();
    props.initialInterval = "year";
    props.plans = props.plans.filter((plan) => plan.code !== "starter_year");
    renderView(props);
    expect(screen.getByRole("button", { name: "Price unavailable" }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Price unavailable" }));
    expect(props.onChangePlan).not.toHaveBeenCalled();
  });

  it("keeps denied data hidden and read-only mutations disabled", () => {
    const props = viewProps();
    const view = renderView({ ...props, canRead: false });
    expect(screen.queryByRole("heading", { name: "Current plan" })).toBeNull();
    expect(screen.queryByText(/Catalogue feature/)).toBeNull();
    view.unmount();
    renderView({ ...props, canWrite: false });
    expect(screen.getByRole("button", { name: "Switch to Starter" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Cancel plan" }).hasAttribute("disabled")).toBe(true);
  });

  it("does not present failed subscription or usage queries as Free or unlimited", () => {
    renderView({ ...viewProps(), subscriptionError: true, usageError: true });
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.queryByText("Free plan")).toBeNull();
    expect(screen.queryByText("/ Unlimited")).toBeNull();
    expect(screen.getAllByText("Usage or limit not reported")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Start free trial" })).toBeNull();
    expect(screen.getByRole("button", { name: "Switch to Starter" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("shows a Free plan and trial only for a loaded, eligible subscription", () => {
    renderView({
      ...viewProps(),
      subscription: {
        ...subscription(),
        status: "none",
        plan_name: "Free",
        plan_code: "free",
        amount_minor: 0,
        currency: "",
      },
      entitlements: {
        plan: "free",
        features: {},
        limits: { seats: 5, apps: 3, api_keys: 2, custom_roles: 0 },
      },
    });
    expect(screen.getByText("Free plan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start free trial" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel plan" })).toBeNull();
  });

  it("holds plan controls while a request is pending and maps errors safely", async () => {
    const props = viewProps();
    let rejectAction: (error: Error) => void = () => {};
    props.onChangePlan = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectAction = reject;
        }),
    );
    renderView(props);
    const button = screen.getByRole("button", { name: "Switch to Starter" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(props.onChangePlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Yearly/ }).hasAttribute("disabled")).toBe(true);
    rejectAction(new Error("private backend stack trace"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByText("private backend stack trace")).toBeNull();
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  });

  it("opens the existing sales form without starting checkout", () => {
    const props = viewProps();
    renderView(props);
    fireEvent.click(screen.getByRole("button", { name: "Contact sales" }));
    expect(within(screen.getByRole("dialog")).getByText("Talk to sales")).toBeTruthy();
    expect(props.onChangePlan).not.toHaveBeenCalled();
  });
});
