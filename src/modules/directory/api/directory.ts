import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import type { DirectoryConnection } from "../directory-model";

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

export const DIRECTORY_QUERY_KEYS = {
  connections: (tenantId: string | null) => ["directory", "connections", tenantId] as const,
  events: (tenantId: string | null, filters: EventFilters) =>
    ["directory", "events", tenantId, filters] as const,
};

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

const eventSchema = z.object({
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
const eventPageSchema = z.object({
  items: z.array(eventSchema),
  total: z.number().nonnegative(),
  limit: z.number(),
  offset: z.number(),
  summary: z.object({
    total: z.number(),
    successful: z.number(),
    warnings: z.number(),
    failed: z.number(),
    average_duration_ms: z.number().nullable(),
  }),
  volume: z.array(z.object({ date: z.string(), users: z.number(), groups: z.number() })),
});

export type DirectoryEvent = z.infer<typeof eventSchema>;
export type DirectoryEventPage = z.infer<typeof eventPageSchema>;

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

const errorPageSchema = z.object({
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

const mappingSchema = z.object({
  id: z.string(),
  source_attribute: z.string(),
  target_field: z.string(),
  value_type: z.enum(["string", "array"]),
  transform: z.enum(["none", "trim", "lowercase", "uppercase", "extract"]),
  pattern: z.string(),
  enabled: z.boolean(),
  required: z.boolean(),
  version: z.number().int(),
});
const mappingsSchema = z.object({
  items: z.array(mappingSchema),
  targets: z.record(z.string(), z.enum(["string", "array"])),
});
const mappingPreviewSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
  values: z.record(z.string(), z.unknown()),
  issues: z.array(z.object({ mapping_id: z.string(), field: z.string(), message: z.string() })),
  valid: z.boolean(),
});
export type DirectoryMapping = z.infer<typeof mappingSchema>;
export type DirectoryMappings = z.infer<typeof mappingsSchema>;
export type MappingPreview = z.infer<typeof mappingPreviewSchema>;
export type MappingInput = Omit<DirectoryMapping, "id" | "version"> & {
  id?: string;
  version?: number;
};

function mappingPath(tenantId: string | null, connectionId: string) {
  return `/v1/tenants/${tenantId}/directory/connections/${encodeURIComponent(connectionId)}/mappings`;
}

export function useDirectoryMappings(connectionId: string) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: ["directory", "mappings", tenantId, connectionId],
    queryFn: () => api(mappingPath(tenantId, connectionId), { schema: mappingsSchema }),
    enabled: !!tenantId && !!connectionId && access.can("connection.read"),
  });
}

export function useSaveDirectoryMapping(connectionId: string) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mapping: MappingInput) => {
      const { id, ...body } = mapping;
      return api(`${mappingPath(tenantId, connectionId)}${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body,
        schema: mappingSchema,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["directory", "mappings", tenantId, connectionId],
      }),
  });
}

export function useDeleteDirectoryMappings(connectionId: string) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids)
        await api(`${mappingPath(tenantId, connectionId)}/${id}`, { method: "DELETE" });
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["directory", "mappings", tenantId, connectionId],
      }),
  });
}

export function usePreviewDirectoryMappings(connectionId: string) {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ source }: { source: Record<string, unknown>; fingerprint: string }) =>
      api(`${mappingPath(tenantId, connectionId)}/preview`, {
        method: "POST",
        body: { source },
        schema: mappingPreviewSchema,
      }),
  });
}

export function useDirectoryErrors(filters: ErrorFilters) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: ["directory", "errors", tenantId, filters],
    queryFn: () =>
      api(`/v1/tenants/${tenantId}/directory/errors`, { query: filters, schema: errorPageSchema }),
    enabled: !!tenantId && access.can("connection.read"),
    staleTime: 15_000,
  });
}

export function useDirectoryErrorAction() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      events,
      action,
    }: {
      events: DirectoryEvent[];
      action: "retry" | "resolve";
    }) => {
      let succeeded = 0;
      for (const event of events) {
        const response = await api(
          `/v1/tenants/${tenantId}/directory/errors/${event.id}/${action}`,
          {
            method: "POST",
            schema: z.object({ succeeded: z.boolean() }),
          },
        );
        if (response.succeeded) succeeded++;
      }
      return { succeeded, total: events.length };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["directory"] }),
  });
}

export async function fetchDirectoryErrorExport(tenantId: string, filters: ErrorFilters) {
  const records: DirectoryEvent[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await api(`/v1/tenants/${tenantId}/directory/errors`, {
      query: { ...filters, limit: 100, offset },
      schema: errorPageSchema,
    });
    if (page.total > 10000)
      throw new Error("Narrow the date range before exporting more than 10,000 records.");
    records.push(...page.items);
    if (records.length >= page.total || page.items.length === 0) break;
  }
  return records;
}

export function useDirectoryEvents(filters: EventFilters, enabled = true) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: DIRECTORY_QUERY_KEYS.events(tenantId, filters),
    queryFn: () =>
      api(`/v1/tenants/${tenantId}/directory/activity`, {
        query: filters,
        schema: eventPageSchema,
      }),
    enabled: !!tenantId && access.can("connection.read") && enabled,
    staleTime: 15_000,
  });
}

export async function fetchDirectoryExport(tenantId: string, filters: EventFilters) {
  const records: DirectoryEvent[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await api(`/v1/tenants/${tenantId}/directory/activity`, {
      query: { ...filters, limit: 100, offset },
      schema: eventPageSchema,
    });
    if (page.total > 10000)
      throw new Error("Narrow the date range before exporting more than 10,000 records.");
    records.push(...page.items);
    if (records.length >= page.total || page.items.length === 0) break;
  }
  return records;
}

export function useCreateDirectoryAlert() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; connection_id: string | null; threshold: number }) =>
      api(`/v1/tenants/${tenantId}/directory/alerts`, { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["directory", "alerts", tenantId] }),
    meta: { successMessage: "Directory alert created" },
  });
}

export function useDirectoryConnections() {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: DIRECTORY_QUERY_KEYS.connections(tenantId),
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
