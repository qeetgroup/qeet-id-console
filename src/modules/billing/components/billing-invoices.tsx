import { CopyIcon, DownloadIcon, EyeIcon, ReceiptTextIcon } from "@qeetrix/icons";
import { Button, MenuItem, Table, type TableColumn } from "@qeetrix/react";
import { Alert, EmptyState, Pagination } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { type CsvColumn, exportToCsv } from "@/shared/utils/data-export";

import { formatMoney, type Invoice, type Plan } from "../api/billing";
import { billingDay, billingPeriod, shortInvoiceId, taxType } from "../billing-format";
import { Section } from "./billing-parts";
import { InvoiceDrawer } from "./invoice-drawer";
import { InvoiceStatus } from "./invoice-status";

const PAGE_SIZE = 10;
// Column headers are part of the file format, so they stay English.
const INVOICE_COLUMNS: CsvColumn<Invoice>[] = [
  { header: "Invoice ID", value: (invoice) => invoice.id },
  { header: "Issued", value: (invoice) => invoice.issued_at },
  { header: "Period start", value: (invoice) => invoice.period_start },
  { header: "Period end", value: (invoice) => invoice.period_end },
  { header: "Plan", value: (invoice) => invoice.plan_code },
  { header: "Currency", value: (invoice) => invoice.currency },
  { header: "Amount (minor units)", value: (invoice) => invoice.amount_minor },
  { header: "Taxable amount (minor units)", value: (invoice) => invoice.taxable_amount_minor },
  { header: "Tax (minor units)", value: (invoice) => invoice.tax_amount_minor },
  { header: "Tax rate (basis points)", value: (invoice) => invoice.tax_rate_bps },
  { header: "Tax type", value: (invoice) => invoice.tax_type },
  { header: "Place of supply", value: (invoice) => invoice.place_of_supply },
  { header: "Status", value: (invoice) => invoice.status },
];

/**
 * The organisation's invoices, newest first, ten a page; each opens as the tax invoice reads. The
 * server returns the last 100, so the paging is the page's own.
 */
export function BillingInvoices({
  invoices,
  plans,
  loading,
  error,
}: {
  invoices?: Invoice[];
  plans: Plan[];
  loading: boolean;
  error: boolean;
}) {
  const { t } = useTranslation("billing");
  const locale = formatLocale();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<Invoice | null>(null);
  const rows = [...(invoices ?? [])].sort(
    (a, b) => (Date.parse(b.issued_at) || 0) - (Date.parse(a.issued_at) || 0),
  );
  const page = rows.slice(offset, offset + PAGE_SIZE);
  const planName = (code: string) => plans.find((plan) => plan.code === code)?.name ?? code;

  async function copyId(invoice: Invoice) {
    try {
      await navigator.clipboard.writeText(invoice.id);
      toast.success(t("invoices.copied"));
    } catch {
      toast.error(t("invoices.copyFailed"));
    }
  }

  const columns: TableColumn<Invoice>[] = [
    {
      id: "invoice",
      header: t("invoices.column.invoice"),
      // The row's button is named by this whole cell, issued date included, until QTRX-21.
      primary: true,
      cell: (invoice) => (
        <span className="ppl-two">
          <span className="account-mono">{shortInvoiceId(invoice.id)}</span>
          <small>{t("invoices.issued", { date: billingDay(invoice.issued_at, locale) })}</small>
        </span>
      ),
    },
    {
      id: "period",
      header: t("invoices.column.period"),
      cell: (invoice) => billingPeriod(invoice.period_start, invoice.period_end, locale),
    },
    {
      id: "taxable",
      header: t("invoices.column.taxable"),
      numeric: true,
      cell: (invoice) => formatMoney(invoice.taxable_amount_minor, invoice.currency),
    },
    {
      id: "tax",
      header: t("invoices.column.tax"),
      numeric: true,
      cell: (invoice) => (
        <span className="ppl-two bill-end">
          <span>{formatMoney(invoice.tax_amount_minor, invoice.currency)}</span>
          <small>
            {t(`invoices.tax.${taxType(invoice)}`, { rate: invoice.tax_rate_bps / 100 })}
          </small>
        </span>
      ),
    },
    {
      id: "total",
      header: t("invoices.column.total"),
      numeric: true,
      cell: (invoice) => (
        <span className="bill-total">{formatMoney(invoice.amount_minor, invoice.currency)}</span>
      ),
    },
    {
      id: "status",
      header: t("invoices.column.status"),
      width: 112,
      cell: (invoice) => <InvoiceStatus status={invoice.status} />,
    },
  ];

  return (
    <Section
      title={t("invoices.title")}
      description={rows.length ? t("invoices.description") : undefined}
      action={
        rows.length > 0 && (
          <Button
            variant="ghost"
            icon={DownloadIcon}
            onClick={() => exportToCsv("billing-invoices", rows, INVOICE_COLUMNS)}
          >
            {t("invoices.export")}
          </Button>
        )
      }
    >
      <div className="bill-invoices">
        <Table<Invoice>
          label={t("invoices.title")}
          rows={page}
          rowId={(invoice) => invoice.id}
          rowLabel={(invoice) => t("invoices.row", { id: shortInvoiceId(invoice.id) })}
          columns={columns}
          loading={loading}
          loadingRows={3}
          onRowClick={setOpen}
          rowActions={(invoice) => (
            <>
              <MenuItem icon={EyeIcon} onClick={() => setOpen(invoice)}>
                {t("invoices.view")}
              </MenuItem>
              <MenuItem icon={CopyIcon} onClick={() => void copyId(invoice)}>
                {t("invoices.copyId")}
              </MenuItem>
            </>
          )}
          error={error ? <Alert tone="danger" title={t("invoices.loadFailed")} /> : undefined}
          empty={
            <EmptyState
              size="section"
              icon={ReceiptTextIcon}
              title={t("invoices.emptyTitle")}
              description={t("invoices.emptyDescription")}
            />
          }
        />
        {rows.length > PAGE_SIZE && (
          <Pagination
            offset={offset}
            pageSize={PAGE_SIZE}
            total={rows.length}
            itemsOnPage={page.length}
            onOffsetChange={setOffset}
            locale={locale}
          />
        )}
      </div>
      <InvoiceDrawer
        invoice={open}
        planName={open ? planName(open.plan_code) : ""}
        onOpenChange={(next) => !next && setOpen(null)}
      />
    </Section>
  );
}
