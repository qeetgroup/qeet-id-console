import { useQuery } from "@tanstack/react-query";

import { DEFAULT_FILTERS, fetchActivityPage } from "@/modules/activity";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { type AuditEvent, isAuthzAction } from "./audit";
import { authzKeys } from "./keys";

export type PolicyChangeKind = "created" | "updated" | "deleted" | "other";

export interface PolicyChange {
  id: string;
  title: string; // e.g. "Permission updated"
  target: string; // a key, name or short id
  actor: string | null; // name, email or short id; null for a system action
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
  // Deletions first: "unassigned" also ends with "assigned".
  if (verb.startsWith("delet") || verb.endsWith("revoked") || verb.endsWith("unassigned")) {
    return "deleted";
  }
  if (verb.startsWith("creat") || verb.endsWith("granted") || verb.endsWith("assigned")) {
    return "created";
  }
  if (verb.startsWith("updat")) return "updated";
  return "other";
}

/** Returns an action's title and change kind: "abac_policy.created" → "Policy created". */
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
 * Returns up to `limit` authorization changes since `from` (RFC3339). Prefers the activity feed,
 * which resolves actor names, and falls back to the audit log when it is empty or undeployed.
 * Both are filtered here: the activity service's `abac.` category would drop `abac_policy.*`.
 */
export function usePolicyChanges(from: string, limit = 5) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: authzKeys.policyChanges(tenantId, from, limit),
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
