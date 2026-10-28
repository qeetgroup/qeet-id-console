import { Badge, type BadgeTone, formatRelativeTime } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import type { Webhook } from "@/modules/developer/api/webhooks";
import {
  endpointParts,
  overlapUntil,
  turnsOffAt,
  type WebhookState,
  webhookState,
} from "@/modules/developer/webhook-state";
import { useNumbers } from "../parts";

export const STATE_TONE: Record<WebhookState, BadgeTone> = {
  active: "success",
  failing: "warning",
  autoDisabled: "danger",
  disabled: "neutral",
};

/** A webhook's state word: Active, Failing, Turned off (by its failures), Disabled (by someone). */
export function WebhookBadge({ webhook, size = "sm" }: { webhook: Webhook; size?: "sm" | "md" }) {
  const { t } = useTranslation("developer");
  const state = webhookState(webhook);
  return (
    <Badge tone={STATE_TONE[state]} size={size}>
      {t(`webhooks.state.${state}`)}
    </Badge>
  );
}

/** One line on why: failing since when and when it turns off, who turned it off, a secret overlap. */
export function useStateLine() {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const day = (iso: string | number) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  return (w: Webhook, now: number): string | undefined => {
    const state = webhookState(w);
    if (state === "failing" && w.failing_since) {
      const off = turnsOffAt(w);
      return t("webhooks.line.failing", {
        since: formatRelativeTime(Date.parse(w.failing_since), locale, now),
        date: off ? day(off) : "",
      });
    }
    if (state === "autoDisabled" && w.disabled_at)
      return t("webhooks.line.autoDisabled", { date: day(w.disabled_at) });
    if (state === "disabled" && w.disabled_at)
      return t("webhooks.line.disabled", { date: day(w.disabled_at) });
    const until = overlapUntil(w, now);
    if (until) return t("webhooks.line.overlap", { when: formatRelativeTime(until, locale, now) });
    return undefined;
  };
}

/** An endpoint as people know it: its host, then the rest of the address in code type. */
export function Endpoint({ url }: { url: string }) {
  const { host, path } = endpointParts(url);
  return (
    <span className="dev-name">
      <strong>{host}</strong>
      {path ? (
        <span className="dev-ident">
          <code title={url}>{path}</code>
        </span>
      ) : null}
    </span>
  );
}
