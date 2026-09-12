import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  type StatusKind,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import {
  ArrowDownToLineIcon,
  EllipsisIcon,
  EyeIcon,
  FileTextIcon,
  ListFilterIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { type CsvColumn, exportToCsv } from "@/shared/utils/data-export";
import { formatMoney, type Invoice, type Plan } from "../api/billing";

const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const INVOICE_STATUS_KINDS = new Map<string, StatusKind>([
  ["paid", "success"],
  ["open", "warning"],
  ["pending", "warning"],
  ["failed", "danger"],
  ["uncollectible", "danger"],
  ["refunded", "info"],
  ["draft", "muted"],
  ["void", "muted"],
]);
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
  { header: "Status", value: (invoice) => invoice.status },
];

export type BillingInvoicesProps = {
  invoices?: Invoice[];
  plans: Plan[];
  loading: boolean;
  error: boolean;
  fetching: boolean;
  onRetry: () => unknown;
};

function InvoiceStatusPill({ status }: { status: string }) {
  const { t } = useTranslation("settings");
  const normalized = status.toLowerCase();
  const kind = INVOICE_STATUS_KINDS.get(normalized) ?? "neutral";

  return (
    <StatusPill
      status={normalized}
      kind={kind}
      className={kind === "info" ? "bg-info/10 text-info" : undefined}
    >
      {t(
        kind === "neutral"
          ? "billing.screen.status.unknown"
          : `billing.screen.invoices.status.${normalized}`,
      )}
    </StatusPill>
  );
}

export function BillingInvoices(props: BillingInvoicesProps) {
  const { t, i18n } = useTranslation("settings");
  const id = useId();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const invoices = props.error ? [] : (props.invoices ?? []);
  const statuses = [...new Set(invoices.map((invoice) => invoice.status))].sort();
  const filtered = invoices
    .filter((invoice) => filter === "all" || invoice.status === filter)
    .sort(
      (first, second) => (Date.parse(second.issued_at) || 0) - (Date.parse(first.issued_at) || 0),
    );
  const selectedInvoice = invoices.find((invoice) => invoice.id === selected?.id);
  const planName = (code: string) => props.plans.find((plan) => plan.code === code)?.name ?? code;
  const statusLabel = (status: string) =>
    t(
      INVOICE_STATUS_KINDS.has(status.toLowerCase())
        ? `billing.screen.invoices.status.${status.toLowerCase()}`
        : "billing.screen.status.unknown",
    );
  const dateLabel = (value: string) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(i18n.language, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(date)
      : t("billing.screen.unavailable");
  };
  const taxLabel = (invoice: Invoice) =>
    invoice.tax_type === "gst_zero_rated"
      ? t("billing.screen.invoices.zeroRated")
      : invoice.tax_type === "vat_reverse_charge"
        ? t("billing.screen.invoices.reverseCharge")
        : formatMoney(invoice.tax_amount_minor, invoice.currency);
  const download = (rows: Invoice[]) => exportToCsv("billing-invoices", rows, INVOICE_COLUMNS);

  return (
    <section aria-labelledby={`${id}-invoices`} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id={`${id}-invoices`} className="font-heading text-base font-semibold">
            {t("billing.invoices.title")}
          </h2>
          {!props.loading && !props.error && (
            <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {invoices.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filter}
            onValueChange={(value) => value && setFilter(value)}
            disabled={props.loading || props.error || invoices.length === 0}
          >
            <SelectTrigger
              aria-label={t("billing.screen.invoices.filter")}
              className={cn(ACTION, "w-34 bg-card/80")}
            >
              <ListFilterIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("billing.screen.invoices.all")}</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className={cn(ACTION, "bg-card/80")}
            onClick={() => download(filtered)}
            disabled={props.loading || props.error || filtered.length === 0}
          >
            <ArrowDownToLineIcon aria-hidden="true" />
            {t("billing.screen.invoices.export")}
          </Button>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none">
        {props.loading ? (
          <div
            role="status"
            aria-label={t("billing.screen.invoices.loading")}
            className="space-y-3 p-4"
          >
            {["first", "second", "third"].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : props.error ? (
          <div
            role="alert"
            className="grid min-h-40 place-content-center justify-items-center gap-3 p-4"
          >
            <p className="text-xs text-muted-foreground">{t("billing.screen.invoices.error")}</p>
            <Button
              variant="outline"
              className={ACTION}
              onClick={() => void props.onRetry()}
              disabled={props.fetching}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("billing.screen.retry")}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid min-h-40 place-content-center justify-items-center gap-2 p-4 text-center">
            <ReceiptTextIcon className="size-7 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              {t(
                invoices.length === 0
                  ? "billing.invoices.empty"
                  : "billing.screen.invoices.noMatches",
              )}
            </p>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table
              aria-label={t("billing.invoices.title")}
              className="w-full min-w-220 table-fixed"
            >
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 w-[23%] ps-4 text-[11px]">
                    {t("billing.screen.invoices.invoice")}
                  </TableHead>
                  <TableHead className="text-[11px]">
                    {t("billing.invoices.columns.period")}
                  </TableHead>
                  <TableHead className="w-[12%] text-[11px]">
                    {t("billing.invoices.columns.plan")}
                  </TableHead>
                  <TableHead className="w-[15%] text-end text-[11px]">
                    {t("billing.invoices.columns.amount")}
                  </TableHead>
                  <TableHead className="w-[12%] text-end text-[11px]">
                    {t("billing.screen.invoices.tax")}
                  </TableHead>
                  <TableHead className="w-40 text-[11px]">
                    {t("billing.invoices.columns.status")}
                  </TableHead>
                  <TableHead className="w-11 pe-3">
                    <span className="sr-only">{t("billing.screen.invoices.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="ps-4 py-3">
                      <button
                        type="button"
                        className="flex max-w-full cursor-pointer items-center gap-2 rounded-sm text-start focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => setSelected(invoice)}
                        aria-label={t("billing.screen.invoices.viewInvoice", { id: invoice.id })}
                      >
                        <FileTextIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs">
                            {invoice.id.slice(0, 12)}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {dateLabel(invoice.issued_at)}
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-[11px] leading-4 text-muted-foreground">
                      {dateLabel(invoice.period_start)}
                      <br />
                      {dateLabel(invoice.period_end)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="block truncate" title={planName(invoice.plan_code)}>
                        {planName(invoice.plan_code)}
                      </span>
                    </TableCell>
                    <TableCell className="text-end text-xs font-medium tabular-nums">
                      {formatMoney(invoice.amount_minor, invoice.currency)}
                    </TableCell>
                    <TableCell className="text-end text-[11px] text-muted-foreground tabular-nums">
                      {taxLabel(invoice)}
                    </TableCell>
                    <TableCell className="text-[11px]">
                      <InvoiceStatusPill status={invoice.status} />
                    </TableCell>
                    <TableCell className="pe-3 text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-md"
                              aria-label={t("billing.screen.invoices.rowActions", {
                                id: invoice.id.slice(0, 12),
                              })}
                              title={t("billing.screen.invoices.actions")}
                            />
                          }
                        >
                          <EllipsisIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelected(invoice)}>
                            <EyeIcon />
                            {t("billing.screen.invoices.view")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => download([invoice])}>
                            <ArrowDownToLineIcon />
                            {t("billing.screen.invoices.download")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Dialog
        open={!!selectedInvoice}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="min-w-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("billing.screen.invoices.details")}</DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">
              {selectedInvoice?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <>
              <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-3 text-xs [&_dd]:text-end [&_dd]:wrap-break-word [&_dt]:text-muted-foreground">
                <dt>{t("billing.invoices.columns.issued")}</dt>
                <dd>{dateLabel(selectedInvoice.issued_at)}</dd>
                <dt>{t("billing.invoices.columns.plan")}</dt>
                <dd>{planName(selectedInvoice.plan_code)}</dd>
                <dt>{t("billing.invoices.columns.period")}</dt>
                <dd>
                  {dateLabel(selectedInvoice.period_start)} /{" "}
                  {dateLabel(selectedInvoice.period_end)}
                </dd>
                <dt>{t("billing.screen.invoices.subtotal")}</dt>
                <dd>
                  {formatMoney(selectedInvoice.taxable_amount_minor, selectedInvoice.currency)}
                </dd>
                <dt>{t("billing.screen.invoices.tax")}</dt>
                <dd>
                  {taxLabel(selectedInvoice)} ({selectedInvoice.tax_rate_bps / 100}%)
                </dd>
                <dt>{t("billing.screen.invoices.supply")}</dt>
                <dd>{selectedInvoice.place_of_supply || t("billing.screen.unavailable")}</dd>
                <dt>{t("billing.invoices.columns.amount")}</dt>
                <dd className="font-semibold">
                  {formatMoney(selectedInvoice.amount_minor, selectedInvoice.currency)}
                </dd>
                <dt>{t("billing.invoices.columns.status")}</dt>
                <dd>
                  <InvoiceStatusPill status={selectedInvoice.status} />
                </dd>
              </dl>
              <div className="flex justify-end border-t border-border/60 pt-4">
                <Button
                  variant="outline"
                  className={ACTION}
                  onClick={() => download([selectedInvoice])}
                >
                  <ArrowDownToLineIcon aria-hidden="true" />
                  {t("billing.screen.invoices.download")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
