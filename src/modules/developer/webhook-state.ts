// What a webhook endpoint's fields say about it, worded by the components.

import i18n from "@/i18n";

import type { Webhook } from "./api/webhooks";

/** An endpoint's state; labelled `developer:webhooks.state.<state>`. */
export type WebhookState = "active" | "failing" | "disabled" | "autoDisabled";

/**
 * Returns the endpoint's state: off by an administrator (`disabled`) or by its own failures
 * (`autoDisabled`), or on and delivering (`active`) or on but failing (`failing`).
 */
export function webhookState(
  w: Pick<Webhook, "disabled_at" | "disabled_reason" | "failing_since">,
): WebhookState {
  if (w.disabled_at) return w.disabled_reason === "failing" ? "autoDisabled" : "disabled";
  return w.failing_since ? "failing" : "active";
}

/** Returns the console's description of a catalogue event, or undefined for one it doesn't know. */
export function webhookEventDescription(name: string): string | undefined {
  const key = `developer:webhookEvents.${name}`;
  return i18n.exists(key) ? i18n.t(key) : undefined;
}
