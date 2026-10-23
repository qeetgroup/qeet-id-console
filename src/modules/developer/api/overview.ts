import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { filterNavigation, useNavGroups } from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";
import { isCurrentCredential, summarizeDeveloperRecords } from "../overview-model";
import { developerKeys } from "./keys";

const SOURCES = [
  { id: "keys", path: "api-keys", permission: "apikey.read" },
  { id: "tokens", path: "oauth/grants", permission: "connection.read" },
  { id: "webhooks", path: "webhooks", permission: "webhook.read" },
  { id: "hooks", path: "auth-hooks", permission: "connection.read" },
  { id: "agents", path: "agents", permission: "apikey.read" },
  { id: "secrets", path: "secrets", permission: "secret.read" },
  { id: "credentials", path: "credentials", permission: "apikey.read" },
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
// The developer audit actions the server records, each read as one whole sentence; any other
// action of a known area reads as a generic change.
const ACTIVITY_ACTIONS = {
  "apikey.created": "keyCreated",
  "apikey.revoked": "keyRevoked",
  "api_key.created": "keyCreated",
  "api_key.revoked": "keyRevoked",
  "webhook.subscription_created": "webhookCreated",
  "webhook.subscription_enabled": "webhookEnabled",
  "webhook.subscription_disabled": "webhookDisabled",
  "webhook.subscription_auto_disabled": "webhookAutoDisabled",
  "webhook.secret_rotated": "webhookSecretRotated",
  "auth_hook.created": "hookCreated",
  "auth_hook.updated": "hookUpdated",
  "auth_hook.deleted": "hookDeleted",
  "agent.created": "agentCreated",
  "agent.suspended": "agentSuspended",
  "agent.resumed": "agentResumed",
  "agent.decommissioned": "agentDecommissioned",
  "agent.deleted": "agentDeleted",
  "agent.kill_switch": "agentsSuspended",
  "agent.sponsor_transferred": "agentsTransferred",
  "secret.created": "secretCreated",
  "secret.updated": "secretUpdated",
  "secret.rotated": "secretRotated",
  "secret.revealed": "secretRevealed",
  "secret.deleted": "secretDeleted",
  "credential.issued": "credentialIssued",
  "credential.revoked": "credentialRevoked",
} as const;

/** What a developer activity row says happened; `changed` for an action it doesn't name. */
export type DeveloperActivityAction =
  | (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS]
  | "changed";

const activityActions = new Map<string, DeveloperActivityAction>(Object.entries(ACTIVITY_ACTIONS));

export type DeveloperActivity = {
  id: string;
  area: DeveloperResourceId;
  action: DeveloperActivityAction;
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
  const navGroups = useNavGroups();
  const ready = !!tenantId && access.state === "ready";
  const requests = useQueries({
    queries: SOURCES.map((source) => ({
      queryKey: developerKeys.overview(tenantId, source.id),
      queryFn: () => api(`/v1/tenants/${tenantId}/${source.path}`, { schema: recordsSchema }),
      select: (response: z.infer<typeof recordsSchema>) => resourceSummary(source.id, response),
      enabled: ready && access.can(source.permission),
      staleTime: 30_000,
      meta: { silent: true },
    })),
  });
  const resources = SOURCES.map((source, index) => {
    const request = requests[index];
    // Unreachable: useQueries returns one result per source; this narrows the type.
    if (!request) throw new Error(`Missing query result for developer source ${source.id}`);
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
    queryKey: developerKeys.overview(tenantId, "activity"),
    queryFn: () =>
      api("/v1/activity", {
        query: { category: "developer", limit: 30 },
        schema: activitySchema,
      }),
    select: (response: z.infer<typeof activitySchema>) =>
      response.events
        .flatMap((event) => {
          const [prefix] = event.type.split(".");
          // split() always yields a first element; the check only narrows the type.
          const area = prefix === undefined ? undefined : ACTIVITY_AREAS[prefix];
          if (!area || !resources.some((resource) => resource.id === area && resource.allowed))
            return [];
          if (!Number.isFinite(Date.parse(event.at))) return [];
          return [
            {
              id: event.id,
              area,
              action: activityActions.get(event.type) ?? "changed",
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
    (group) => group.id === "developer",
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
