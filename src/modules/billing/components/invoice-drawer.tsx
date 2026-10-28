import { Drawer, DrawerBody, DrawerContent, formatDateTime, Text } from "@qeetrix/react";
import { CopyButton, DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";

import { formatMoney, type Invoice } from "../api/billing";
import { billingPeriod, shortInvoiceId, taxLines, taxType } from "../billing-format";
import { InvoiceStatus } from "./invoice-status";

/**
 * One invoice as a tax invoice reads: its amounts (the taxable value, each GST line and the
 * total), then its reference. The server keeps one tax amount per invoice, so intra-state GST
 * shows as equal CGST and SGST halves. It stores no billed-to details with an invoice, so none
 * are shown: today's billing details may not be what the invoice was issued to.
 */
export function InvoiceDrawer({
  invoice,
  planName,
  onOpenChange,
}: {
  invoice: Invoice | null;
  planName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("billing");
  const locale = formatLocale();
  const id = invoice ? shortInvoiceId(invoice.id) : "";
  const period = invoice ? billingPeriod(invoice.period_start, invoice.period_end, locale) : "";
  const money = (minor: number) => (invoice ? formatMoney(minor, invoice.currency) : "");
  const lines = invoice ? taxLines(invoice) : [];
  const type = invoice ? taxType(invoice) : "none";

  return (
    <Drawer open={!!invoice} onOpenChange={onOpenChange}>
      <DrawerContent
        title={t("invoice.title", { id })}
        description={t("invoice.description", { plan: planName, period })}
        size="md"
      >
        <DrawerBody>
          {invoice && (
            <div className="bill-drawer">
              <div className="bill-drawer-head">
                <InvoiceStatus status={invoice.status} />
                <Text size="sm" tone="subtle">
                  {t("invoice.issued", { date: formatDateTime(invoice.issued_at, locale) })}
                </Text>
              </div>
              <section className="bill-group" aria-labelledby="invoice-amount">
                <h3 id="invoice-amount" className="bill-group-label">
                  {t("invoice.amount")}
                </h3>
                <dl className="bill-sum">
                  <div>
                    <dt>{t("invoice.taxable")}</dt>
                    <dd>{money(invoice.taxable_amount_minor)}</dd>
                  </div>
                  {lines.length > 0 ? (
                    lines.map((line) => (
                      <div key={line.kind}>
                        <dt>{t(`invoice.line.${line.kind}`, { rate: line.rate })}</dt>
                        <dd>{money(line.amount)}</dd>
                      </div>
                    ))
                  ) : (
                    <div>
                      <dt>
                        {t(
                          `invoice.noLine.${type === "gst_cgst_sgst" || type === "gst_igst" ? "none" : type}`,
                        )}
                      </dt>
                      <dd>{money(invoice.tax_amount_minor)}</dd>
                    </div>
                  )}
                  <div className="bill-sum-total">
                    <dt>{t("invoice.total")}</dt>
                    <dd>{money(invoice.amount_minor)}</dd>
                  </div>
                </dl>
              </section>
              <section className="bill-group" aria-labelledby="invoice-reference">
                <h3 id="invoice-reference" className="bill-group-label">
                  {t("invoice.reference")}
                </h3>
                <DescriptionList>
                  <DescriptionItem term={t("invoice.id")}>
                    <span className="bill-copy">
                      <span className="account-mono">{invoice.id}</span>
                      <CopyButton value={invoice.id} label={t("invoices.copyId")} size="sm" />
                    </span>
                  </DescriptionItem>
                  <DescriptionItem term={t("invoice.plan")}>{planName}</DescriptionItem>
                  <DescriptionItem term={t("invoice.period")}>{period}</DescriptionItem>
                  {invoice.place_of_supply && (
                    <DescriptionItem term={t("invoice.placeOfSupply")}>
                      {invoice.place_of_supply}
                    </DescriptionItem>
                  )}
                </DescriptionList>
              </section>
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
