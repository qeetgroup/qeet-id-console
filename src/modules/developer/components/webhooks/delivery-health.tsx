import { formatDateTime } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import type { Webhook, WebhookDelivery } from "@/modules/developer/api/webhooks";
import { countOutcomes, deliveriesOverTime, OUTCOMES } from "@/modules/developer/webhook-state";
import { useNumbers } from "../parts";
import { OUTCOME_COLOR } from "./delivery-parts";

// Bottom to top: what worked, then what's still to go, then what gave up.
const STACK = ["delivered", "queued", "retrying", "held", "gaveUp"] as const;

/**
 * The recent deliveries over time, a column a bucket (5 minutes, an hour or a day, by the span they
 * cover) stacked by outcome, every bucket to now (a quiet spell is a gap, not a missing column).
 * Under it, the outcomes with their counts. It shows what the list can't: when the failures started
 * and whether they stopped.
 * Library gap (new): a small stacked column chart.
 */
export function DeliveryHealth({
  deliveries,
  webhook,
  now,
}: {
  deliveries: readonly WebhookDelivery[];
  webhook: Webhook;
  now: number;
}) {
  const { t } = useTranslation("developer");
  const { locale, n } = useNumbers();
  const { unit, buckets } = deliveriesOverTime(deliveries, webhook, now);
  const counts = countOutcomes(deliveries, webhook);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const at = (ms: number) =>
    unit === "day"
      ? new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short" })
      : formatDateTime(ms, locale, { dateStyle: "medium", timeStyle: "short" });
  const label = t("health.label", {
    unit: t(`health.unit.${unit}`),
    from: at(buckets[0]?.start ?? now),
    parts: buckets
      .filter((b) => b.total)
      .map((b) =>
        t("health.bucketLabel", {
          at: at(b.start),
          parts: STACK.filter((o) => b.counts[o])
            .map((o) => `${n(b.counts[o])} ${t(`delivery.outcome.${o}`).toLowerCase()}`)
            .join(", "),
        }),
      )
      .join("; "),
  });

  return (
    <figure className="dev-health">
      <div
        className="dev-health-cols"
        role="img"
        aria-label={label}
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
      >
        {buckets.map((b) => (
          <span key={b.start} className="dev-health-col">
            <span className="dev-health-bar" style={{ blockSize: `${(b.total / max) * 100}%` }}>
              {STACK.filter((o) => b.counts[o]).map((o) => (
                <span key={o} style={{ flexGrow: b.counts[o], background: OUTCOME_COLOR[o] }} />
              ))}
            </span>
          </span>
        ))}
      </div>
      <div className="dev-health-axis" aria-hidden="true">
        <span>{at(buckets[0]?.start ?? now)}</span>
        <span>{t("health.now")}</span>
      </div>
      <figcaption className="dev-health-legend">
        <span className="dev-health-unit">{t(`health.each.${unit}`)}</span>
        <ul>
          {OUTCOMES.filter((o) => counts[o]).map((o) => (
            <li key={o}>
              <span
                className="dev-swatch"
                style={{ background: OUTCOME_COLOR[o] }}
                aria-hidden="true"
              />
              <b>{n(counts[o])}</b> {t(`delivery.outcome.${o}`)}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
