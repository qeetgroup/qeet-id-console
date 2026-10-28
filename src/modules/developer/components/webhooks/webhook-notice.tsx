import { formatDateTime, formatRelativeTime } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import type { Webhook } from "@/modules/developer/api/webhooks";
import {
  type Outcome,
  overlapUntil,
  turnsOffAt,
  webhookState,
} from "@/modules/developer/webhook-state";
import { useNumbers } from "../parts";

/** The state's alert, with room above it. */
export function StateNotice(props: {
  webhook: Webhook;
  now: number;
  counts: Record<Outcome, number>;
}) {
  return (
    <div className="dev-notice">
      <StateAlert {...props} />
    </div>
  );
}

function StateAlert({
  webhook: w,
  now,
  counts,
}: {
  webhook: Webhook;
  now: number;
  counts: Record<Outcome, number>;
}) {
  const { t } = useTranslation("developer");
  const { locale, n } = useNumbers();
  const state = webhookState(w);
  const date = (iso: string | number) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long" });
  const until = overlapUntil(w, now);
  if (state === "autoDisabled" && w.disabled_at)
    return (
      <Alert tone="danger" title={t("webhook.notice.autoTitle", { date: date(w.disabled_at) })}>
        {t("webhook.notice.auto", {
          count: counts.held,
          held: n(counts.held),
          gaveUp: n(counts.gaveUp),
        })}
      </Alert>
    );
  if (state === "failing" && w.failing_since) {
    const off = turnsOffAt(w);
    return (
      <Alert
        tone="warning"
        title={t("webhook.notice.failingTitle", {
          since: formatRelativeTime(Date.parse(w.failing_since), locale, now),
        })}
      >
        {t("webhook.notice.failing", {
          date: off ? formatDateTime(off, locale, { dateStyle: "long", timeStyle: "short" }) : "",
        })}
      </Alert>
    );
  }
  if (state === "disabled" && w.disabled_at)
    return (
      <Alert tone="info" title={t("webhook.notice.disabledTitle", { date: date(w.disabled_at) })}>
        {t("webhook.notice.disabled", { count: counts.held, held: n(counts.held) })}
      </Alert>
    );
  if (until)
    return (
      <Alert tone="info" title={t("webhook.notice.overlapTitle")}>
        {t("webhook.notice.overlap", {
          when: formatDateTime(until, locale, { dateStyle: "medium", timeStyle: "short" }),
        })}
      </Alert>
    );
  return null;
}
