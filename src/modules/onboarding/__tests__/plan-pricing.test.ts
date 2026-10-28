import { describe, expect, it } from "vitest";

import type { Plan } from "@/modules/billing";
import {
  bestYearlySaving,
  currencyLabel,
  defaultCurrency,
  formatPrice,
  planCurrencies,
  planOffers,
  roundToWhole,
} from "../plan-pricing";

const plan = (code: string, name: string, prices: Record<string, number>): Plan => ({
  id: code,
  code,
  name,
  description: `${name} line`,
  interval: code.endsWith("_year") ? "year" : "month",
  features: [`${name} feature`],
  prices,
});
// The server's built-in catalogue: yearly is ten times the monthly price.
const catalogue = [
  plan("free", "Free", { INR: 0, USD: 0 }),
  plan("starter", "Starter", { INR: 240_000, USD: 2_900 }),
  plan("pro", "Pro", { INR: 800_000, USD: 9_900 }),
  plan("enterprise", "Enterprise", { INR: 2_490_000, USD: 29_900 }),
  plan("starter_year", "Starter", { INR: 2_400_000, USD: 29_000 }),
  plan("pro_year", "Pro", { INR: 8_000_000, USD: 99_000 }),
];

describe("plan pricing", () => {
  it("offers the four plans in order, Enterprise through sales", () => {
    const offers = planOffers(catalogue, "month", "INR");
    expect(offers.map((offer) => offer.tier)).toEqual(["free", "starter", "pro", "enterprise"]);
    expect(offers[3]).toMatchObject({ contactSales: true, price: undefined, unavailable: false });
    expect(offers[0]).toMatchObject({ planCode: "free", price: 0 });
  });

  it("billed monthly, says what yearly would cost and save", () => {
    const starter = planOffers(catalogue, "month", "INR")[1];
    expect(starter).toMatchObject({ planCode: "starter", price: 240_000 });
    // ₹2,400 × 12 = ₹28,800; yearly is ₹24,000.
    expect(starter?.yearlyAlternative).toEqual({ price: 2_400_000, saving: 480_000 });
    expect(starter?.yearly).toBeUndefined();
  });

  it("billed yearly, shows the twelve months at the monthly price and the saving", () => {
    const [free, starter, pro] = planOffers(catalogue, "year", "INR");
    expect(free?.yearly).toBeUndefined();
    expect(starter).toMatchObject({ planCode: "starter_year", price: 2_400_000 });
    expect(starter?.yearly).toEqual({
      monthly: 200_000,
      twelveMonths: 2_880_000,
      saving: 480_000,
      percent: 17,
    });
    // ₹80,000 / 12 is ₹6,666.67, shown as ₹6,667.
    expect(pro?.yearly?.monthly).toBe(666_700);
    expect(bestYearlySaving(catalogue, "INR")).toBe(17);
  });

  it("never prices a plan the catalogue doesn't, and never shows a monthly price as yearly", () => {
    const noAnnual = catalogue.filter((item) => item.code !== "pro_year");
    const pro = planOffers(noAnnual, "year", "INR")[2];
    expect(pro).toMatchObject({ planCode: "pro_year", price: undefined, unavailable: true });
    expect(planOffers(noAnnual, "month", "INR")[2]?.yearlyAlternative).toBeUndefined();
    const euro = planOffers(catalogue, "month", "EUR")[1];
    expect(euro).toMatchObject({ unavailable: true, price: undefined });
  });

  it("picks INR first, and formats whole amounts without decimals", () => {
    expect(planCurrencies(catalogue)).toEqual(["INR", "USD"]);
    expect(defaultCurrency(["EUR", "INR", "USD"])).toBe("INR");
    expect(defaultCurrency(["EUR", "USD"])).toBe("USD");
    expect(formatPrice(240_000, "INR")).toBe("₹2,400");
    expect(formatPrice(666_667, "INR")).toBe("₹6,666.67");
    expect(formatPrice(4_500, "JPY")).toBe("¥4,500");
    expect(roundToWhole(4_501, "JPY")).toBe(4_501);
    expect(currencyLabel("INR")).toBe("INR (₹)");
  });
});
