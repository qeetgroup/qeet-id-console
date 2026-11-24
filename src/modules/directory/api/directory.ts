import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { isOneOf } from "@/shared/utils/one-of";
import { backend } from "@/platform/api/backend";
import type { Answer, Schemas } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import type { DirectoryConnection } from "../directory-model";
import { READ_PAGE, useCursorList } from "@/platform/query/cursor-list";
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

const connectionsSchema = strictly<
  Answer<"/v1/organizations/{organizationID}/directory/connections">
>()(z.object({ items: z.array(connectionSchema) }));

/** A list's filters; "" is no filter. `limit` is the one read's size (a list pages itself). */
export type EventFilters = {
  days: number;
  connection_id: string;
  status: string;
  q: string;
  limit: number;
};

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  days: 7,
  connection_id: "",
  status: "",
  q: "",
  limit: 25,
};

/** The filters as the server takes them: an empty one left out, since it refuses an unknown value. */
export function filterQuery<F extends Record<string, string | number>>(filters: F) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "")) as {
    [K in keyof F]?: F[K];
  };
}

/** One directory operation: a sync push, a manual run or a sign-in, and how it went. */
export type DirectoryEvent = Schemas<"federation">["DirectoryEvent"];

export type ErrorFilters = Omit<EventFilters, "status"> & { severity: string; resolution: string };
export const DEFAULT_ERROR_FILTERS: ErrorFilters = {
  days: 7,
  connection_id: "",
  severity: "",
  resolution: "",
  q: "",
  limit: 25,
};

const ERRORS = "/v1/organizations/{organizationID}/directory/errors" as const;
export type DirectoryErrorPage = Answer<typeof ERRORS>;

/** One read of the errors list, from `cursor`. */
export function readDirectoryErrors(
  organizationId: string,
  filters: ErrorFilters,
  cursor?: string,
  signal?: AbortSignal,
) {
  return backend.get(ERRORS, {
    path: { organizationID: organizationId ?? "" },
    query: { ...errorQuery(filters), cursor },
    signal,
  });
}

const SEVERITIES = ["warning", "critical"] as const;
const RESOLUTIONS = ["open", "resolved", "retried"] as const;

// The severity and resolution the server knows; any other value means no filter.
function errorQuery({ severity, resolution, ...rest }: ErrorFilters) {
  return {
    ...filterQuery(rest),
    severity: isOneOf(SEVERITIES, severity) ? severity : undefined,
    resolution: isOneOf(RESOLUTIONS, resolution) ? resolution : undefined,
  };
}

/** The errors list a page at a time: `offset` and `pageSize` are the page on show. */
export function useDirectoryErrorList(filters: ErrorFilters, offset: number, pageSize: number) {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  return useCursorList(
    [...directoryKeys.errors(organizationId, filters), "list"],
    (cursor, signal) =>
      readDirectoryErrors(organizationId ?? "", { ...filters, limit: READ_PAGE }, cursor, signal),
    { offset, pageSize, enabled: !!organizationId && access.can("connection.read") },
  );
}

/** `keep`: a list's next page or filter keeps the rows on show while it loads. */
export function useDirectoryErrors(filters: ErrorFilters, { keep = false } = {}) {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.errors(organizationId, filters),
    queryFn: ({ signal }) => readDirectoryErrors(organizationId ?? "", filters, undefined, signal),
    enabled: !!organizationId && access.can("connection.read"),
    staleTime: 15_000,
    placeholderData: keep ? keepPreviousData : undefined,
  });
}

export function useDirectoryConnections() {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.connections(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/directory/connections", {
        path: { organizationID: organizationId ?? "" },
        schema: connectionsSchema,
      }),
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
    enabled: !!organizationId && access.can("connection.read"),
    staleTime: 30_000,
  });
}
