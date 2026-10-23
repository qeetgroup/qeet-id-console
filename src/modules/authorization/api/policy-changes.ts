import { useQuery } from "@tanstack/react-query";

import i18n from "@/i18n";
import { DEFAULT_FILTERS, fetchActivityPage } from "@/modules/activity";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { type AuditEvent, isAuthzAction, RESOURCE_TYPE_LABELS } from "./audit";
import { authzKeys } from "./keys";

export type PolicyChangeKind = "created" | "updated" | "deleted" | "other";

export interface PolicyChange {
  id: string;
  action: string; // e.g. "permission.updated"
  title: string; // the activity feed's own title, if any; see policyChangeTitle
  target: string; // a key, name or short id
  actor: string | null; // name, email or short id; null for a system action
  at: string;
  kind: PolicyChangeKind;
}

// Catalogue keys for the entity an action is about.
const ENTITY_LABELS: Record<string, string> = {
  ...RESOURCE_TYPE_LABELS,
  policy: "rbac:resourceTypes.policy",
  relation: "rbac:resourceTypes.relationTuple",
};

// Catalogue keys for a verb, each a title with the entity in it, such as "{{entity}} created".
const VERB_TITLES: Record<string, string> = {
  created: "rbac:policyChanges.created",
  updated: "rbac:policyChanges.updated",
  deleted: "rbac:policyChanges.deleted",
  granted: "rbac:policyChanges.granted",
  revoked: "rbac:policyChanges.revoked",
  assigned: "rbac:policyChanges.assigned",
  unassigned: "rbac:policyChanges.unassigned",
  permission_granted: "rbac:policyChanges.permissionGranted",
  permission_revoked: "rbac:policyChanges.permissionRevoked",
  group_assigned: "rbac:policyChanges.groupAssigned",
  group_unassigned: "rbac:policyChanges.groupUnassigned",
  assign_refused: "rbac:policyChanges.assignRefused",
};

// The relationship store names its actions after the engine, not the entity.
const ACTION_ALIASES: Record<string, string> = {
  "rebac.tuple_written": "relation_tuple.created",
  "rebac.tuple_deleted": "relation_tuple.deleted",
};

function own(table: Record<string, string>, key: string): string | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

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

function splitAction(action: string): { entity: string; verb: string } {
  const canonical = own(ACTION_ALIASES, action) ?? action;
  const dot = canonical.indexOf(".");
  return dot === -1
    ? { entity: canonical, verb: "" }
    : { entity: canonical.slice(0, dot), verb: canonical.slice(dot + 1) };
}

// Returns the console's own title for an action, or null when it has none.
function curatedTitle(action: string): string | null {
  const { entity, verb } = splitAction(action);
  const entityKey = own(ENTITY_LABELS, entity);
  if (!entityKey) return null;
  if (!verb) return i18n.t(entityKey);
  const verbKey = own(VERB_TITLES, verb);
  return verbKey ? i18n.t(verbKey, { entity: i18n.t(entityKey) }) : null;
}

/**
 * Returns an action's title, translated when called, and its change kind:
 * "abac_policy.created" → "ABAC policy created". An action the console doesn't know reads as
 * its sentence-cased enum.
 */
export function describePolicyAction(action: string): { title: string; kind: PolicyChangeKind } {
  const { entity, verb } = splitAction(action);
  const title =
    curatedTitle(action) ??
    `${entity} ${verb}`
      .replace(/_/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  return { title, kind: kindOf(verb) };
}

/** Returns a change's title: the console's own, else the activity feed's, else the action's. */
export function policyChangeTitle(change: PolicyChange): string {
  return (
    curatedTitle(change.action) || change.title.trim() || describePolicyAction(change.action).title
  );
}

function fromAudit(event: AuditEvent): PolicyChange {
  return {
    id: event.id,
    action: event.action,
    title: "",
    target: event.resource_id ? event.resource_id.slice(0, 8) : event.resource_type,
    actor: event.actor_user_id ? event.actor_user_id.slice(0, 8) : null,
    at: event.created_at,
    kind: describePolicyAction(event.action).kind,
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
          return {
            id: e.id,
            action: e.type,
            title: e.title ?? "",
            target: e.target?.label ?? e.target?.id ?? e.target?.type ?? "",
            actor: e.actor?.name ?? (e.actor?.id ? e.actor.id.slice(0, 8) : null),
            at: e.at,
            kind: describePolicyAction(e.type).kind,
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
