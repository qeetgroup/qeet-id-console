import { Badge, type BadgeTone } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { isOneOf } from "@/shared/utils/one-of";

// Each status reads `billing.invoices.status.<status>`; any other reads as unknown.
const INVOICE_STATUSES = [
  "paid",
  "open",
  "pending",
  "failed",
  "uncollectible",
  "refunded",
  "draft",
  "void",
] as const;
const STATUS_TONE: Record<(typeof INVOICE_STATUSES)[number], BadgeTone> = {
  paid: "success",
  open: "warning",
  pending: "warning",
  failed: "danger",
  uncollectible: "danger",
  refunded: "info",
  draft: "neutral",
  void: "neutral",
};

/** An invoice's status as a badge, in words; a status the console doesn't know says so. */
export function InvoiceStatus({ status }: { status: string }) {
  const { t } = useTranslation("billing");
  const known = status.toLowerCase();
  return isOneOf(INVOICE_STATUSES, known) ? (
    <Badge tone={STATUS_TONE[known]} size="sm">
      {t(`invoices.status.${known}`)}
    </Badge>
  ) : (
    <Badge tone="neutral" size="sm">
      {t("invoices.status.unknown")}
    </Badge>
  );
}
