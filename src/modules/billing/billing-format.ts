// Dates, periods and tax lines as the Billing page writes them. Pure, so they're tested alone.
import { formatDate } from "@qeetrix/react";

import { formatLocale } from "@/i18n";

import type { Invoice } from "./api/billing";

const ZONE = "Asia/Kolkata"; // the library's default zone, so a period and its dates agree

/** "18 Nov 2026"; an unreadable date gives "". */
export function billingDay(value: string | null | undefined, locale = formatLocale()): string {
  return value ? formatDate(value, locale, { dateStyle: "medium" }) : "";
}

/** "18 Oct – 18 Nov 2026": one year written once when both ends share it. */
export function billingPeriod(start: string, end: string, locale = formatLocale()): string {
  const from = new Date(start);
  const to = new Date(end);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: ZONE,
    }).formatRange(from, to);
  } catch {
    return `${billingDay(start, locale)} – ${billingDay(end, locale)}`;
  }
}

/** The first eight characters of an invoice ID, as its row and drawer name it. */
export function shortInvoiceId(id: string): string {
  return id.slice(0, 8);
}

export type TaxLine = { kind: "cgst" | "sgst" | "igst"; rate: number; amount: number };

/**
 * The tax lines a GST invoice lists. The server stores one tax amount and rate; intra-state GST is
 * CGST and SGST in equal halves (an odd paisa goes to SGST), inter-state is IGST. Zero-rated,
 * reverse-charge and untaxed invoices have no lines.
 */
export function taxLines(invoice: Invoice): TaxLine[] {
  const rate = invoice.tax_rate_bps / 100;
  if (invoice.tax_type === "gst_cgst_sgst") {
    const half = Math.floor(invoice.tax_amount_minor / 2);
    return [
      { kind: "cgst", rate: rate / 2, amount: half },
      { kind: "sgst", rate: rate / 2, amount: invoice.tax_amount_minor - half },
    ];
  }
  if (invoice.tax_type === "gst_igst") {
    return [{ kind: "igst", rate, amount: invoice.tax_amount_minor }];
  }
  return [];
}

/** Each tax type's words: `billing.invoices.tax.<type>`; any other reads as untaxed. */
export const TAX_TYPES = [
  "gst_cgst_sgst",
  "gst_igst",
  "gst_zero_rated",
  "vat_reverse_charge",
  "none",
] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export function taxType(invoice: Invoice): TaxType {
  return (TAX_TYPES as readonly string[]).includes(invoice.tax_type)
    ? (invoice.tax_type as TaxType)
    : "none";
}
