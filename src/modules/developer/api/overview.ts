import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { filterNavigation, navGroups } from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";
import { isCurrentCredential, summarizeDeveloperRecords } from "../overview-model";

const SOURCES = [
  { id: "keys", key: "api-keys", path: "api-keys", permission: "apikey.read" },
  { id: "tokens", key: "oauth-grants", path: "oauth/grants", permission: "connection.read" },
  { id: "webhooks", key: "webhooks", path: "webhooks", permission: "webhook.read" },
  { id: "hooks", key: "auth-hooks", path: "auth-hooks", permission: "connection.read" },
  { id: "agents", key: "agents", path: "agents", permission: "apikey.read" },
  { id: "secrets", key: "secrets", path: "secrets", permission: "secret.read" },
  { id: "credentials", key: "credentials", path: "credentials", permission: "apikey.read" },
] as const;

export type DeveloperResourceId = (typeof SOURCES)[number]["id"];

const recordSchema = z
  .object({
    id: z.string(),
    created_at: z.string().nullish(),
    issued_at: z.string().nullish(),
    expires_at: z.string().nullish(),
    revoked_at: z.string().nullish(),
    revoked: z.boolean().optional(),
    disabled_at: z.string().nullish(),
    disabled: z.boolean().optional(),
    enabled: z.boolean().optional(),
    status: z.string().optional(),
  })
  .passthrough();
const recordsSchema = z.object({ items: z.array(recordSchema) }).passthrough();

const activitySchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      at: z.string(),
      target: z.object({ id: z.string().optional() }).nullish(),
    }),
  ),
});

const ACTIVITY_AREAS: Record<string, DeveloperResourceId> = {
  apikey: "keys",
  api_key: "keys",
  webhook: "webhooks",
  auth_hook: "hooks",
  agent: "agents",
  secret: "secrets",
  credentials: "credentials",
  credential: "credentials",
  vc: "credentials",
};
const ACTIVITY_VERBS = new Set([
  "created",
  "updated",
  "rotated",
  "revoked",
  "deleted",
  "enabled",
  "disabled",
  "issued",
  "delivered",
  "suspended",
  "decommissioned",
]);

export type DeveloperActivity = {
  id: string;
  area: DeveloperResourceId;
  verb: string;
  at: string;
  targetId?: string;
};

function resourceSummary(id: DeveloperResourceId, response: z.infer<typeof recordsSchema>) {
  const records =
    id === "keys" || id === "tokens"
      ? response.items.filter((record) => isCurrentCredential(record))
      : response.items;
  const configured = records.some((record) => {
    if (id === "hooks") return record.enabled === true;
    if (id === "agents") return record.status === "active" && record.disabled !== true;
    if (id === "webhooks") return !record.disabled_at;
    if (id === "credentials") return record.revoked === false && isCurrentCredential(record);
    return true;
  });
  return { ...summarizeDeveloperRecords(records), configured };
}

export function useDeveloperOverview() {
  const tenantId = useTenantId();
  const access = useCapabilities();
  const ready = !!tenantId && access.state === "ready";
  const requests = useQueries({
    queries: SOURCES.map((source) => ({
      queryKey: [source.key, tenantId],
      queryFn: () => api(`/v1/tenants/${tenantId}/${source.path}`, { schema: recordsSchema }),
      select: (response: z.infer<typeof recordsSchema>) => resourceSummary(source.id, response),
      enabled: ready && access.can(source.permission),
      staleTime: 30_000,
      meta: { silent: true },
    })),
  });
  const resources = SOURCES.map((source, index) => {
    const request = requests[index];
    const allowed = ready && access.can(source.permission);
    return {
      id: source.id,
      allowed,
      loading: allowed && request.isPending,
      error: allowed && request.isError,
      busy: allowed && request.isFetching,
      data: allowed && !request.isError ? request.data : undefined,
      retry: request.refetch,
    };
  });

  const canReadActivity = ready && access.can("audit.read");
  const activity = useQuery({
    queryKey: ["developer-overview", "activity", tenantId],
    queryFn: () =>
      api("/v1/activity", {
        query: { category: "developer", limit: 30 },
        schema: activitySchema,
      }),
    select: (response: z.infer<typeof activitySchema>) =>
      response.events
        .flatMap((event) => {
          const [prefix, action] = event.type.split(".");
          const area = ACTIVITY_AREAS[prefix];
          if (!area || !resources.some((resource) => resource.id === area && resource.allowed))
            return [];
          if (!Number.isFinite(Date.parse(event.at))) return [];
          return [
            {
              id: event.id,
              area,
              verb: ACTIVITY_VERBS.has(action) ? action : "changed",
              at: event.at,
              targetId: event.target?.id,
            } satisfies DeveloperActivity,
          ];
        })
        .slice(0, 5),
    enabled: canReadActivity,
    staleTime: 30_000,
    meta: { silent: true },
  });

  const developerGroup = filterNavigation(navGroups, access.can).find(
    (group) => group.label === "Developer",
  );

  return {
    tenantId,
    accessState: access.state,
    resources,
    areas: ready ? (developerGroup?.items ?? []).filter((item) => item.url !== "/developer") : [],
    canCreateKey: ready && access.canAll(["apikey.read", "apikey.write"]),
    canCreateWebhook: ready && access.canAll(["webhook.read", "webhook.write"]),
    activity: {
      allowed: canReadActivity,
      loading: canReadActivity && activity.isPending,
      error: canReadActivity && activity.isError,
      busy: canReadActivity && activity.isFetching,
      data: canReadActivity && !activity.isError ? activity.data : undefined,
      retry: activity.refetch,
    },
  };
}

export type DeveloperOverviewData = ReturnType<typeof useDeveloperOverview>;
