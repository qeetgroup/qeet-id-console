// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";
import { formatMoney, type Plan, usePlans } from "@/modules/billing";
import { api } from "@/platform/api/client";
import { type PlanSelection, PlanSelect } from "../plan-select";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => null }));
vi.mock("@/modules/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/billing")>();
  return {
    ...actual,
    usePlans: vi.fn(),
    ContactSalesDialog: ({
      open,
      onOpenChange,
    }: ComponentProps<typeof actual.ContactSalesDialog>) =>
      open ? (
        <dialog open aria-label="Contact sales">
          <button type="button" onClick={() => onOpenChange(false)}>
            Close
          </button>
        </dialog>
      ) : null,
  };
});

function plan(code: string, name: string, inr: number, usd: number): Plan {
  return {
    id: code,
    code,
    name,
    description: `${name} catalogue description`,
    interval: code.endsWith("_year") ? "year" : "month",
    features: [`${code} catalogue feature`, `${name} support`],
    prices: { INR: inr, USD: usd },
  };
}
const catalogue = {
  free: plan("free", "Free", 0, 0),
  starter: plan("starter", "Starter", 240_000, 2_900),
  pro: plan("pro", "Pro", 800_000, 9_900),
  enterprise: plan("enterprise", "Enterprise", 0, 0),
  starter_year: plan("starter_year", "Starter", 2_400_000, 29_000),
  pro_year: plan("pro_year", "Pro", 8_000_000, 99_000),
};
const onSelect = vi.fn();
const refetch = vi.fn();
const card = (name: string) => within(screen.getByRole("article", { name }));
const cta = (name: string) => card(name).getByRole("button");
const cycle = () => within(screen.getByRole("group", { name: "Billing cycle" }));
const yearly = () => cycle().getByRole("button", { name: /^Yearly/ });
const currencySelect = () => screen.getByRole("combobox", { name: "Currency" });
const mount = (props: Partial<ComponentProps<typeof PlanSelect>> = {}) =>
  render(<PlanSelect onSelect={onSelect} {...props} />);

function mockPlans(items = Object.values(catalogue), state: Record<string, unknown> = {}) {
  vi.mocked(usePlans).mockReturnValue({
    data: { items },
    isLoading: false,
    isError: false,
    refetch,
    ...state,
  } as unknown as ReturnType<typeof usePlans>);
}
async function chooseUsd() {
  fireEvent.mouseDown(currencySelect(), { button: 0 });
  const option = await screen.findByRole("option", { name: "USD ($)" });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
}
beforeEach(() => {
  vi.clearAllMocks();
  mockPlans();
});
afterEach(() => {
  cleanup();
  expect(api).not.toHaveBeenCalled();
});

describe("PlanSelect", () => {
  it("renders four catalogue cards and features, default INR, and computed 17% savings", () => {
    mount();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    for (const entry of Object.values(catalogue).slice(0, 4)) {
      expect(screen.getByRole("article", { name: entry.name }).dataset.tier).toBe(entry.code);
      expect(card(entry.name).getByRole("heading", { name: entry.name, level: 2 })).toBeTruthy();
      expect(card(entry.name).getAllByText(entry.description).length).toBeGreaterThan(0);
      const features = card(entry.name)
        .getAllByRole("listitem")
        .map((item) => item.textContent);
      expect(features).toEqual(entry.features);
    }
    expect(cycle().getByRole("button", { name: "Monthly", pressed: true })).toBeTruthy();
    expect(yearly().getAttribute("aria-pressed")).toBe("false");
    expect(within(yearly()).getByText("Save 17%")).toBeTruthy();
    expect(within(currencySelect()).getByText("INR (₹)")).toBeTruthy();
    expect(card("Enterprise").getByText("Custom")).toBeTruthy();
  });

  it.each([
    ["starter", "INR", "IN"],
    ["starter", "USD", "US"],
    ["pro", "INR", "IN"],
    ["pro", "USD", "US"],
  ] as const)("selects %s monthly then yearly in %s (%s)", async (tier, currency, country) => {
    mount();
    if (currency === "USD") await chooseUsd();
    const monthly = catalogue[tier];
    const annual = catalogue[`${tier}_year`];
    const panel = card(monthly.name);
    const selection = { tier, planCode: tier, interval: "month", currency, country };
    expect(panel.getByText(formatMoney(monthly.prices[currency], currency))).toBeTruthy();
    expect(panel.getByText("/ month")).toBeTruthy();
    fireEvent.click(cta(monthly.name));
    expect(onSelect).toHaveBeenNthCalledWith(1, selection);
    fireEvent.click(yearly());
    expect(yearly().getAttribute("aria-pressed")).toBe("true");
    expect(cycle().getByRole("button", { name: "Monthly", pressed: false })).toBeTruthy();
    expect(panel.getByText(formatMoney(annual.prices[currency], currency))).toBeTruthy();
    expect(panel.getByText("/ year")).toBeTruthy();
    const equivalent = formatMoney(Math.round(annual.prices[currency] / 12), currency);
    expect(panel.getByText(`≈ ${equivalent} / month, billed yearly`)).toBeTruthy();
    fireEvent.click(cta(annual.name));
    const annualSelection = { ...selection, planCode: `${tier}_year`, interval: "year" };
    expect(onSelect).toHaveBeenNthCalledWith(2, annualSelection);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("restores a yearly USD choice on return and still selects Free with its base code", () => {
    const saved: PlanSelection = {
      tier: "pro",
      planCode: "pro_year",
      interval: "year",
      currency: "USD",
      country: "US",
    };
    mount({ initialSelection: saved });
    expect(yearly().getAttribute("aria-pressed")).toBe("true");
    expect(within(currencySelect()).getByText("USD ($)")).toBeTruthy();
    expect(card("Pro").getByText(formatMoney(catalogue.pro_year.prices.USD, "USD"))).toBeTruthy();
    fireEvent.click(cta("Pro"));
    expect(onSelect).toHaveBeenLastCalledWith(saved);
    fireEvent.click(cta("Free"));
    expect(onSelect).toHaveBeenLastCalledWith({ ...saved, tier: "free", planCode: "free" });
  });

  it.each([
    ["starter_year", "variant"],
    ["starter_year", "currency price"],
    ["starter", "currency price"],
  ] as const)("blocks a missing %s %s without a monthly price fallback", (code, missing) => {
    const items = Object.values(catalogue).filter((entry) => entry.code !== code);
    if (missing === "currency price") {
      items.push({ ...catalogue[code], prices: { USD: catalogue[code].prices.USD } });
    }
    mockPlans(items);
    mount();
    if (code.endsWith("_year")) fireEvent.click(yearly());
    expect(cta("Starter").matches(":disabled")).toBe(true);
    expect(cta("Starter").textContent).toBe("Unavailable in this currency or cycle");
    expect(card("Starter").getByText("—")).toBeTruthy();
    const monthlyPrice = formatMoney(catalogue.starter.prices.INR, "INR");
    expect(card("Starter").queryByText(monthlyPrice)).toBeNull();
    expect(card("Starter").queryByText(/billed yearly/)).toBeNull();
    expect(card("Starter").getAllByRole("listitem")).toHaveLength(2);
    expect(cta("Pro").matches(":disabled")).toBe(false);
    fireEvent.click(cta("Starter"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens and closes Enterprise contact sales without selecting a plan", () => {
    mount();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(card("Enterprise").getByRole("button", { name: "Contact sales" }));
    const dialog = screen.getByRole("dialog", { name: "Contact sales" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(["free", "starter", "pro", "enterprise"] as const)(
    "disables only current %s, then all buttons and currency while busy",
    (currentTier) => {
      const { rerender } = mount({ currentTier });
      for (const entry of Object.values(catalogue).slice(0, 4)) {
        expect(cta(entry.name).matches(":disabled")).toBe(entry.code === currentTier);
      }
      fireEvent.click(screen.getByRole("button", { name: "Current plan" }));
      rerender(<PlanSelect onSelect={onSelect} currentTier={currentTier} busyTier="starter" />);
      for (const button of screen.getAllByRole("button")) {
        expect(button.matches(":disabled")).toBe(true);
        fireEvent.click(button);
      }
      expect(currencySelect().matches(":disabled")).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  it("offers a safe retry instead of exposing the private backend error", () => {
    const error = new Error("private backend database host: billing.internal");
    mockPlans([], { isError: true, error });
    const { container } = mount();
    expect(screen.getAllByRole("alert")[0].textContent).toContain(
      "We couldn’t load the plans. Please try again.",
    );
    expect(container.textContent).not.toContain(error.message);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it.each([true, false])("renders loading or empty state (loading=%s)", (isLoading) => {
    mockPlans([], { isLoading });
    mount();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    if (isLoading) {
      const status = screen.getByRole("status", { name: "Loading plans" });
      expect(status.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4);
      for (const button of cycle().getAllByRole("button")) {
        expect(button.matches(":disabled")).toBe(true);
      }
    } else {
      expect(screen.getByText("No plans are available right now.")).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
    }
  });

  it.each([false, true])("keeps one responsive or stacked grid (stacked=%s)", (stacked) => {
    mount({ stacked });
    const cards = screen.getAllByRole("article");
    const grid = cards[0].parentElement;
    expect(cards).toHaveLength(4);
    expect(cards.every((article) => article.parentElement === grid)).toBe(true);
    expect(grid?.classList.contains("grid-cols-1")).toBe(true);
    expect(grid?.classList.contains("@min-[460px]/plans:grid-cols-2")).toBe(!stacked);
    expect(grid?.classList.contains("@min-[850px]/plans:grid-cols-4")).toBe(!stacked);
  });
});
