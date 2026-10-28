import { Badge, type BadgeTone, formatRelativeTime } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import type { Webhook, WebhookDelivery } from "@/modules/developer/api/webhooks";
import {
  MAX_ATTEMPTS,
  notRetried,
  type Outcome,
  outcomeOf,
} from "@/modules/developer/webhook-state";
import { useNumbers } from "../parts";

export const OUTCOME_TONE: Record<Outcome, BadgeTone> = {
  delivered: "success",
  retrying: "warning",
  queued: "info",
  held: "neutral",
  gaveUp: "danger",
};
// The health strip's colours: delivered, still to go, held, gave up.
export const OUTCOME_COLOR: Record<Outcome, string> = {
  delivered: "var(--qx-color-dataviz-positive)",
  retrying: "var(--qx-color-dataviz-warning)",
  queued: "var(--qx-color-dataviz-sequential-4)",
  held: "var(--qx-color-border-strong)",
  gaveUp: "var(--qx-color-dataviz-negative)",
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation("developer");
  return (
    <Badge tone={OUTCOME_TONE[outcome]} size="sm">
      {t(`delivery.outcome.${outcome}`)}
    </Badge>
  );
}

type ErrorKind = "host" | "timeout" | "refused" | "tls" | "status" | "other";
/** What a transport error was, from the server's error text (Go's net/http words). */
function errorKind(error: string): ErrorKind {
  const e = error.toLowerCase();
  if (e.includes("no such host") || e.includes("server misbehaving")) return "host";
  if (e.includes("timeout") || e.includes("deadline exceeded")) return "timeout";
  if (e.includes("connection refused") || e.includes("connection reset")) return "refused";
  if (e.includes("x509") || e.includes("certificate") || e.includes("tls")) return "tls";
  if (e.includes("non-2xx")) return "status";
  return "other";
}

/** The delivery's words: the endpoint's answer, and one line on where the delivery stands. */
export function useDeliveryWords() {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  return {
    answer: (d: WebhookDelivery) => {
      if (d.status_code) return t("delivery.answer.code", { code: d.status_code });
      if (d.error) return t(`delivery.answer.${errorKind(d.error)}`);
      return t("delivery.answer.none");
    },
    line: (d: WebhookDelivery, w: Webhook, now: number) => {
      const outcome = outcomeOf(d, w);
      if (outcome === "delivered")
        return d.attempt > 1
          ? t("delivery.line.onAttempt", { n: d.attempt })
          : t("delivery.line.firstTry");
      if (outcome === "gaveUp")
        return notRetried(d)
          ? t("delivery.line.refused", { code: d.status_code })
          : t("delivery.line.gaveUp", { n: d.attempt });
      if (outcome === "held") return t("delivery.line.held");
      if (outcome === "retrying" && d.next_attempt_at) {
        const next = Date.parse(d.next_attempt_at);
        return next > now
          ? t("delivery.line.next", {
              when: formatRelativeTime(next, locale, now),
              n: d.attempt,
              max: MAX_ATTEMPTS,
            })
          : t("delivery.line.nextNow", { n: d.attempt, max: MAX_ATTEMPTS });
      }
      return t("delivery.line.queued");
    },
  };
}
