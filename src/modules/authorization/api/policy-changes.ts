// "Recent policy changes" for the Authorization overview.
//
// Two sources, in preference order:
//   1. GET /v1/activity — resolves the actor's display name / email server-side,
//      which is what the overview wants to show. It 404s where the activity
//      service isn't deployed, and the activity module already turns that into
//      an empty page rather than an error.
//   2. GET /v1/tenants/{t}/audit — always present, but carries only an actor
//      UUID, so the byline degrades to a short id.
//
// Both are filtered to authorization actions with the same predicate, and
// normalised to one shape so the card doesn't care which answered.

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_FILTERS, fetchActivityPage } from "@/modules/activity";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { type AuditEvent, isAuthzAction } from "./audit";

export type PolicyChangeKind = "created" | "updated" | "deleted" | "other";

export interface PolicyChange {
  id: string;
  /** Humanised action, e.g. "Permission updated". */
  title: string;
  /** What it happened to — a key, name or short id. */
  target: string;
  /** Display name, email, or short actor id; null for system actions. */
  actor: string | null;
  at: string;
  kind: PolicyChangeKind;
}

const ENTITY_LABELS: Record<string, string> = {
  role: "Role",
  permission: "Permission",
  abac_policy: "Policy",
  rbac_policy: "Policy",
  policy: "Policy",
  relation_tuple: "Relationship",
  relation: "Relationship",
  group_role: "Group role",
  security_policy: "Security policy",
};

function kindOf(verb: string): PolicyChangeKind {
  if (verb.startsWith("creat") || verb.endsWith("granted") || verb.endsWith("assigned")) {
    return "created";
  }
  if (verb.startsWith("delet") || verb.endsWith("revoked") || verb.endsWith("unassigned")) {
    return "deleted";
  }
  if (verb.startsWith("updat")) return "updated";
  return "other";
}

/** "abac_policy.created" → { title: "Policy created", kind: "created" }. */
export function describePolicyAction(action: string): { title: string; kind: PolicyChangeKind } {
  const dot = action.indexOf(".");
  const entity = dot === -1 ? action : action.slice(0, dot);
  const verb = dot === -1 ? "" : action.slice(dot + 1);
  const label = ENTITY_LABELS[entity] ?? entity.replace(/_/g, " ");
  const readableVerb = verb.replace(/_/g, " ");
  return {
    title: `${label}${readableVerb ? ` ${readableVerb}` : ""}`.replace(/^./, (c) =>
      c.toUpperCase(),
    ),
    kind: kindOf(verb),
  };
}

function fromAudit(event: AuditEvent): PolicyChange {
  const { title, kind } = describePolicyAction(event.action);
  return {
    id: event.id,
    title,
    target: event.resource_id ? event.resource_id.slice(0, 8) : event.resource_type,
    actor: event.actor_user_id ? event.actor_user_id.slice(0, 8) : null,
    at: event.created_at,
    kind,
  };
}

/**
 * Recent authorization changes since `from` (RFC3339). `limit` caps what the
 * card renders, not what is fetched — both feeds are filtered client-side,
 * because an `abac_policy.*` action doesn't match the activity service's
 * `abac.` category prefix and would be dropped by a server-side filter.
 */
export function usePolicyChanges(from: string, limit = 5) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["authz-policy-changes", tenantId, from, limit],
    enabled: !!tenantId,
    queryFn: async (): Promise<PolicyChange[]> => {
      const page = await fetchActivityPage({ ...DEFAULT_FILTERS, from }, "", 100);
      const activity = page.events
        .filter((e) => isAuthzAction(e.type))
        .map<PolicyChange>((e) => {
          const described = describePolicyAction(e.type);
          return {
            id: e.id,
            title: e.title || described.title,
            target: e.target?.label ?? e.target?.id ?? e.target?.type ?? "",
            actor: e.actor?.name ?? (e.actor?.id ? e.actor.id.slice(0, 8) : null),
            at: e.at,
            kind: described.kind,
          };
        });
      if (activity.length > 0) return activity.slice(0, limit);

      // Activity is empty or undeployed — fall back to the audit log.
      const audit = await api<{ items: AuditEvent[] }>(`/v1/tenants/${tenantId}/audit`, {
        query: { limit: 100 },
      });
      return audit.items
        .filter((e) => isAuthzAction(e.action) && e.created_at >= from)
        .slice(0, limit)
        .map(fromAudit);
    },
  });
}
