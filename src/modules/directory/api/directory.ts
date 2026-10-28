import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import type { DirectoryConnection } from "../directory-model";
import { directoryKeys } from "./keys";

const connectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  reference: z.string(),
  type: z.enum(["scim", "ldap"]),
  status: z.enum(["configured", "active", "draft", "disabled"]),
  health: z.enum(["healthy", "warning", "failed", "unknown"]),
  environment: z.string().nullable(),
  scope: z.enum(["users-and-groups", "users-on-signin"]),
  created_at: z.string().nullable(),
  last_activity_at: z.string().nullable(),
  last_sync_at: z.string().nullable(),
  user_count: z.number().int().nonnegative().nullable(),
  group_count: z.number().int().nonnegative().nullable(),
  server_url: z.string().nullable(),
});

const connectionsSchema = z.object({ items: z.array(connectionSchema) });

export type EventFilters = {
  days: number;
  connection_id: string;
  status: string;
  q: string;
  limit: number;
  offset: number;
};

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  days: 7,
  connection_id: "",
  status: "",
  q: "",
  limit: 25,
  offset: 0,
};

export const eventSchema = z.object({
  id: z.string(),
  connection_id: z.string(),
  operation: z.string(),
  trigger: z.enum(["push", "manual", "sign-in"]),
  resource_type: z.enum(["user", "group", "connection"]),
  resource_id: z.string(),
  started_at: z.string(),
  duration_ms: z.number().nonnegative(),
  http_status: z.number(),
  status: z.enum(["success", "warning", "failed"]),
  users_synced: z.number().nonnegative(),
  groups_synced: z.number().nonnegative(),
  error_code: z.string(),
  message: z.string(),
  category: z.string(),
  severity: z.enum(["", "warning", "critical"]),
  resolution: z.enum(["open", "resolved", "retried"]),
  resolved_at: z.string().nullable(),
  retry_of: z.string().nullable(),
  retryable: z.boolean(),
});
export type DirectoryEvent = z.infer<typeof eventSchema>;

export type ErrorFilters = Omit<EventFilters, "status"> & { severity: string; resolution: string };
export const DEFAULT_ERROR_FILTERS: ErrorFilters = {
  days: 7,
  connection_id: "",
  severity: "",
  resolution: "",
  q: "",
  limit: 25,
  offset: 0,
};

export const errorPageSchema = z.object({
  items: z.array(eventSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  summary: z.object({
    open: z.number(),
    critical: z.number(),
    warning: z.number(),
    retried: z.number(),
    impacted_users: z.number().nullable(),
  }),
  categories: z.array(z.object({ key: z.string(), count: z.number() })),
  connections: z.array(z.object({ key: z.string(), count: z.number() })),
  remediations: z.array(eventSchema),
});
export type DirectoryErrorPage = z.infer<typeof errorPageSchema>;

/** `keep`: a list's next page or filter keeps the rows on show while it loads. */
export function useDirectoryErrors(filters: ErrorFilters, { keep = false } = {}) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.errors(tenantId, filters),
    queryFn: () =>
      api(`/v1/tenants/${tenantId}/directory/errors`, { query: filters, schema: errorPageSchema }),
    enabled: !!tenantId && access.can("connection.read"),
    staleTime: 15_000,
    placeholderData: keep ? keepPreviousData : undefined,
  });
}

export function useDirectoryConnections() {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.connections(tenantId),
    queryFn: () =>
      api(`/v1/tenants/${tenantId}/directory/connections`, { schema: connectionsSchema }),
    select: (response): DirectoryConnection[] =>
      response.items.map((record) => ({
        id: record.id,
        name: record.name,
        reference: record.reference,
        type: record.type,
        status: record.status,
        health: record.health,
        environment: record.environment,
        scope: record.scope,
        createdAt: record.created_at,
        lastActivityAt: record.last_activity_at,
        lastSyncAt: record.last_sync_at,
        userCount: record.user_count,
        groupCount: record.group_count,
        serverUrl: record.server_url,
      })),
    enabled: !!tenantId && access.can("connection.read"),
    staleTime: 30_000,
  });
}
