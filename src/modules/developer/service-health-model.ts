// Service health, in the console's words: the server's states, components and reasons are matched
// to the sets it sends today before they pick copy (developer:infrastructure.health.*). Pure.

import type { BadgeTone } from "@qeetrix/react";
import type { AlertTone } from "@qeetrix/react/experimental";
import type { ParseKeys } from "i18next";

import { isOneOf } from "@/shared/utils/one-of";
import type { HealthIncident } from "./api/service-health";

export const HEALTH_STATES = [
  "operational",
  "maintenance",
  "degraded",
  "outage",
  "not_configured",
] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

export const HEALTH_COMPONENTS = ["api", "sign_in", "email", "webhooks", "directory"] as const;
export type HealthComponentName = (typeof HEALTH_COMPONENTS)[number];

/** Why a part isn't operational: the server's reason codes, each worded in `health.reason.*`. */
export const HEALTH_REASONS = [
  "api.database_unreachable",
  "sign_in.keys_unavailable",
  "email.failing",
  "webhooks.failing",
  "directory.failing",
  "incident",
] as const;
export type HealthReason = (typeof HEALTH_REASONS)[number];

/** A state the console words, or `unknown` for one a newer server sends. */
export function stateOf(value: string): HealthState | "unknown" {
  return isOneOf(HEALTH_STATES, value) ? value : "unknown";
}

/** A component the console words, or `other` for one a newer server sends. */
export function componentOf(value: string): HealthComponentName | "other" {
  return isOneOf(HEALTH_COMPONENTS, value) ? value : "other";
}

/** The reason's code when the console words it; a reason it doesn't know is left unsaid. */
export function reasonOf(value: string | undefined): HealthReason | undefined {
  return value !== undefined && isOneOf(HEALTH_REASONS, value) ? value : undefined;
}

/** Each reason's words, a key in the developer catalogue. */
export const REASON_LABEL: Record<HealthReason, ParseKeys<"developer">> = {
  "api.database_unreachable": "infrastructure.health.reason.databaseUnreachable",
  "sign_in.keys_unavailable": "infrastructure.health.reason.keysUnavailable",
  "email.failing": "infrastructure.health.reason.emailFailing",
  "webhooks.failing": "infrastructure.health.reason.webhooksFailing",
  "directory.failing": "infrastructure.health.reason.directoryFailing",
  incident: "infrastructure.health.reason.incident",
};

export const STATE_BADGE_TONE: Record<HealthState | "unknown", BadgeTone> = {
  operational: "success",
  maintenance: "info",
  degraded: "warning",
  outage: "danger",
  not_configured: "neutral",
  unknown: "neutral",
};

/** An incident's alert: its impact picks the tone, the same way a part's state picks its badge. */
export function incidentTone(impact: string): AlertTone {
  const state = stateOf(impact);
  if (state === "outage") return "danger";
  if (state === "degraded") return "warning";
  return "info";
}

/** Open incidents first (newest first), then those resolved in the last 14 days (newest first). */
export function splitIncidents(incidents: readonly HealthIncident[]) {
  const time = (at: string | null | undefined) => (at ? Date.parse(at) : 0);
  const open = incidents
    .filter((i) => !i.resolved_at)
    .sort((a, b) => time(b.started_at) - time(a.started_at));
  const resolved = incidents
    .filter((i) => i.resolved_at)
    .sort((a, b) => time(b.resolved_at) - time(a.resolved_at));
  return { open, resolved };
}
