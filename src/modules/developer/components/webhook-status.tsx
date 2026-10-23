import { StatusPill, TimeSince } from "@qeetrix/ui";
import { Trans, useTranslation } from "react-i18next";

import type { Webhook } from "../api/webhooks";
import { type WebhookState, webhookState } from "../webhook-state";

const STATE_KIND: Record<WebhookState, "success" | "warning" | "danger" | "muted"> = {
  active: "success",
  failing: "warning",
  disabled: "muted",
  autoDisabled: "danger",
};

/** Renders an endpoint's state: active, failing, or disabled by an administrator or its failures. */
export function WebhookStatusPill({ webhook }: { webhook: Webhook }) {
  const { t } = useTranslation("developer");
  const state = webhookState(webhook);
  return (
    <StatusPill kind={STATE_KIND[state]} dot>
      {t(`webhooks.state.${state}`)}
    </StatusPill>
  );
}

/**
 * Renders why an endpoint isn't delivering: failing since when, or disabled by an administrator or
 * by its failures. Renders nothing for a healthy endpoint.
 */
export function WebhookStatusNote({ webhook }: { webhook: Webhook }) {
  const { t } = useTranslation("developer");
  const state = webhookState(webhook);
  if (state === "active") return null;
  const since = webhook.failing_since ? <TimeSince value={webhook.failing_since} /> : null;
  return (
    <p className="text-sm text-muted-foreground">
      {state === "disabled" ? (
        t("webhooks.stateNote.disabled")
      ) : since ? (
        <Trans t={t} i18nKey={`webhooks.stateNote.${state}Since`} components={{ since }} />
      ) : (
        t(`webhooks.stateNote.${state}`)
      )}
    </p>
  );
}
