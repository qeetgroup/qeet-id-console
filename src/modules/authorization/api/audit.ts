// The audit log is the only record of who changed which policy, role or relation, and when.

import { useQuery } from "@tanstack/react-query";

import type { TranslationKey } from "@/i18n";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

export interface AuditEvent {
  id: string;
  tenant_id: string | null;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface AuditResponse {
  items: AuditEvent[];
  next_cursor: string;
}

export interface AuditFilter {
  action?: string;
  resource_type?: string;
  actor_user_id?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}

export const AUTHZ_RESOURCE_TYPES = [
  "abac_policy",
  "role",
  "rbac_policy",
  "relation_tuple",
  "permission",
  "group_role",
  "security_policy",
] as const;
export type AuthzResourceType = (typeof AUTHZ_RESOURCE_TYPES)[number];

/** Catalogue keys for the authorization resource types. */
export const RESOURCE_TYPE_LABELS: Record<AuthzResourceType, TranslationKey> = {
  abac_policy: "authorization:resourceTypes.abacPolicy",
  role: "authorization:resourceTypes.role",
  rbac_policy: "authorization:resourceTypes.rbacPolicy",
  relation_tuple: "authorization:resourceTypes.relationTuple",
  permission: "authorization:resourceTypes.permission",
  group_role: "authorization:resourceTypes.groupRole",
  security_policy: "authorization:resourceTypes.securityPolicy",
};

/** Returns the catalogue key for a resource type, or null for a type without a label. */
export function resourceTypeKey(type: string): TranslationKey | null {
  return Object.hasOwn(RESOURCE_TYPE_LABELS, type)
    ? RESOURCE_TYPE_LABELS[type as AuthzResourceType]
    : null;
}

export function useAuditEvents(filter: AuditFilter = {}) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authzKeys.audit(tenantId, filter),
    enabled: !!tenantId,
    queryFn: () =>
      api<AuditResponse>(`/v1/tenants/${tenantId}/audit`, {
        query: {
          action: filter.action || undefined,
          resource_type: filter.resource_type || undefined,
          actor_user_id: filter.actor_user_id || undefined,
          q: filter.q || undefined,
          limit: filter.limit ?? 100,
          cursor: filter.cursor || undefined,
        },
      }),
  });
}

/** Returns whether an audit or activity action belongs to the authorization domain. */
export function isAuthzAction(action: string): boolean {
  // `rebac.` covers the relationship tuples (rebac.tuple_written, rebac.tuple_deleted).
  return /^(abac|rbac|rebac|role|group_role|permission|relation|policy|security_policy)[._]/i.test(
    action,
  );
}

/** Returns whether an event is about authorization, by resource type or action prefix. */
export function isAuthzEvent(e: AuditEvent): boolean {
  if ((AUTHZ_RESOURCE_TYPES as readonly string[]).includes(e.resource_type)) return true;
  return isAuthzAction(e.action);
}

export interface VersionEntry {
  id: string;
  action: string;
  actor: string;
  at: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Returns one resource's audit events as a newest-first timeline. There is no rollback
 * endpoint, so this history is read-only.
 */
export function toVersionTimeline(events: AuditEvent[], resourceId: string): VersionEntry[] {
  return events
    .filter((e) => e.resource_id === resourceId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor_user_id ?? e.actor_type ?? "system",
      at: e.created_at,
      metadata: e.metadata,
    }));
}
