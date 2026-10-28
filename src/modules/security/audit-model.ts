// The audit log as Security › Monitoring › Audit log reads it: its address, the actions and
// resources its filters offer, and who did each thing. The server filters by exact action,
// resource type and actor, and searches action, resource type, actor type, user agent and
// metadata as words (websearch_to_tsquery); it has no time filter or total.

import type { AuditEvent } from "./api/audit-log";

/** The page's address: the log's filters, the view, and the event open in the drawer. */
export type AuditSearch = {
  q?: string;
  action?: string;
  resource_type?: string;
  actor_user_id?: string;
  view?: "flagged";
  status?: "resolved";
  event?: string;
};

/** The filters the log sends; the rest of the address is the page's own. */
export function auditFilters(s: AuditSearch) {
  return {
    q: s.q ?? "",
    action: s.action ?? "",
    resource_type: s.resource_type ?? "",
    actor_user_id: s.actor_user_id ?? "",
  };
}

export function isFiltered(s: AuditSearch): boolean {
  return !!(s.q || s.action || s.resource_type || s.actor_user_id);
}

/**
 * The actions the Action filter offers, by what they're about: ones the server records today
 * (verified in qeet-id-server). A filter on any other action still works from the address.
 */
export const ACTION_GROUPS = {
  signIn: [
    "auth.login_succeeded",
    "auth.sign_in_failed",
    "auth.mfa_challenged",
    "auth.sign_in_confirmed",
    "auth.account_locked",
    "auth.source_throttled",
    "auth.address_refused",
    "auth.token_reuse_detected",
    "auth.signed_out",
  ],
  sessions: [
    "auth.other_sessions_revoked",
    "auth.all_sessions_revoked",
    "session.admin_revoked_all",
    "auth.trusted_device_added",
    "oauth.device_revoked",
  ],
  people: [
    "user.created",
    "user.updated",
    "invite.created",
    "invite.accepted",
    "group.member_added",
    "group.member_removed",
    "mfa.admin_reset",
  ],
  settings: [
    "security_policy.updated",
    "auth_policy.updated",
    "ip_rules.enforcement_changed",
    "ip_rules.rule_added",
    "ip_rules.rule_removed",
    "rate_limits.updated",
    "retention.policy_updated",
  ],
  keys: [
    "apikey.created",
    "apikey.revoked",
    "oidc.client_registered",
    "oidc.client_secret_rotated",
    "siem.sink_created",
  ],
} as const;
export type ActionGroup = keyof typeof ACTION_GROUPS;

/** The resource types the Resource filter offers: the ones events name most. */
export const RESOURCE_TYPES = [
  "user",
  "session",
  "group",
  "invite",
  "tenant",
  "oidc_client",
  "api_key",
  "webhook_subscription",
  "ip_rule",
  "log_sink",
  "domain",
  "scim_token",
  "oidc_device_code",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export function isResourceType(type: string): type is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(type);
}

/** Who did it: a person (by ID), Qeet ID itself, a machine principal, or nobody signed in. */
export type ActorKind = "person" | "system" | "machine" | "anonymous";
export function actorKind(e: Pick<AuditEvent, "actor_type" | "actor_user_id">): ActorKind {
  if (e.actor_type === "system") return "system";
  if (e.actor_type === "anonymous" || (!e.actor_user_id && e.actor_type === "user"))
    return "anonymous";
  if (e.actor_type === "user" || e.actor_type === "admin_portal") return "person";
  return e.actor_user_id ? "person" : "machine";
}

/** The first eight characters of an ID, as the list shows it. */
export function short(id?: string | null): string {
  return id ? id.slice(0, 8) : "";
}
