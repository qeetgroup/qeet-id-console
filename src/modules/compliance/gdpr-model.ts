// What the GDPR view works out from erasure requests. Pure, so it's tested on its own.

import type { PurgeRequest, PurgeStatus } from "./api/gdpr";

/** An erased account's email is replaced with `redacted-<id>@gdpr.invalid` (gdpr.purgeTenantUserData). */
export const isErased = (email: string) => email.endsWith("@gdpr.invalid");

export const PURGE_LOOK: Record<PurgeStatus, "warning" | "neutral" | "danger"> = {
  pending: "warning",
  completed: "neutral",
  cancelled: "neutral",
  quarantined: "danger",
};

/** The waiting requests, the soonest erasure first. */
export function pendingOf(requests: readonly PurgeRequest[]): PurgeRequest[] {
  return requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => Date.parse(a.grace_until) - Date.parse(b.grace_until));
}
