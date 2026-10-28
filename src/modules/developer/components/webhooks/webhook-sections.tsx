import { KeyRoundIcon } from "@qeetrix/icons";
import { Button, formatDateTime, formatRelativeTime } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import type { Webhook, WebhookEventType } from "@/modules/developer/api/webhooks";
import {
  areaOf,
  EVENT_AREAS,
  overlapUntil,
  webhookEventDescription,
} from "@/modules/developer/webhook-state";
import { DevSection, useNumbers } from "../parts";

const HEADERS = ["signature", "timestamp", "event", "delivery"] as const;

/** The events it gets, by area, each with how much of that area of the catalogue it takes. */
export function EventsSection({
  webhook: w,
  catalogue,
}: {
  webhook: Webhook;
  catalogue: readonly WebhookEventType[];
}) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  return (
    <DevSection id="wh-events" title={t("webhook.events.title")} note={t("webhook.events.note")}>
      <div className="dev-areas">
        {EVENT_AREAS.map((area) => {
          const mine = w.events.filter((e) => areaOf(e) === area);
          if (!mine.length) return null;
          const total = catalogue.filter((e) => areaOf(e.name) === area).length;
          return (
            <div key={area} className="dev-area">
              <div className="dev-area-head">
                <span className="dev-area-name">{t(`webhooks.area.${area}`)}</span>
                <span className="dev-area-count">
                  {total
                    ? t("webhook.events.ofArea", { n: n(mine.length), total: n(total) })
                    : n(mine.length)}
                </span>
                {total ? (
                  <span
                    className="dev-area-meter"
                    role="img"
                    aria-label={t("webhook.events.ofArea", {
                      n: n(mine.length),
                      total: n(total),
                    })}
                  >
                    <span style={{ inlineSize: `${(mine.length / total) * 100}%` }} />
                  </span>
                ) : null}
              </div>
              <ul className="dev-area-events">
                {mine.map((e) => (
                  <li key={e}>
                    <code className="dev-code">{e}</code>
                    <small>{webhookEventDescription(e) ?? t("webhook.events.undescribed")}</small>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </DevSection>
  );
}

/**
 * The signing secret: the current one (hidden: it was shown once), the previous one while it still
 * signs (24 hours after a rotation, as a bar of the time left), and the headers to check.
 */
export function SecretSection({
  webhook: w,
  now,
  onRotate,
}: {
  webhook: Webhook;
  now: number;
  onRotate?: () => void;
}) {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const overlap = overlapUntil(w, now);
  const when = (ms: number) =>
    formatDateTime(ms, locale, { dateStyle: "medium", timeStyle: "short" });
  return (
    <DevSection
      id="wh-secret"
      title={t("webhook.secret.title")}
      note={t("webhook.secret.note")}
      action={
        onRotate ? (
          <Button variant="ghost" size="sm" icon={KeyRoundIcon} onClick={onRotate}>
            {t("webhook.secret.rotate")}
          </Button>
        ) : undefined
      }
    >
      <div className="dev-facts">
        <div className="dev-fact">
          <p className="dev-fact-cap">{t("webhook.secret.current")}</p>
          <p className="dev-fact-value">{t("webhook.secret.hidden")}</p>
          <p className="dev-fact-note">{t("webhook.secret.currentNote")}</p>
        </div>
        <div className="dev-fact">
          <p className="dev-fact-cap">{t("webhook.secret.previous")}</p>
          {overlap ? (
            <>
              <p className="dev-fact-value">
                {t("webhook.secret.until", {
                  when: formatRelativeTime(overlap, locale, now),
                })}
              </p>
              <span
                className="dev-overlap"
                role="img"
                aria-label={t("webhook.secret.overlapLabel", { when: when(overlap) })}
              >
                <span
                  style={{
                    inlineSize: `${Math.min(100, ((overlap - now) / 86_400_000) * 100)}%`,
                  }}
                />
              </span>
              <p className="dev-fact-note">
                {t("webhook.secret.previousNote", { when: when(overlap) })}
              </p>
            </>
          ) : (
            <>
              <p className="dev-fact-value is-none">{t("webhook.secret.none")}</p>
              <p className="dev-fact-note">{t("webhook.secret.noneNote")}</p>
            </>
          )}
        </div>
      </div>
      <dl className="dev-headers">
        {HEADERS.map((h) => (
          <div key={h}>
            <dt>
              <code className="dev-code">{t(`webhook.secret.headers.${h}.name`)}</code>
            </dt>
            <dd>{t(`webhook.secret.headers.${h}.what`)}</dd>
          </div>
        ))}
      </dl>
    </DevSection>
  );
}
