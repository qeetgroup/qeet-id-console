// AI agents trade their secret at the token endpoint (POST /v1/oauth/token, client_credentials,
// the agent's id as client_id) for a short-lived, scoped token marked actor_type "agent". The
// secret is returned only once, on create.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { authKeys } from "@/modules/authentication";
import { useOrganizationId } from "@/platform/auth/session";
import { developerKeys } from "./keys";
import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  token_ttl_seconds: z.number().int(),
  status: z.enum(["active", "suspended", "decommissioned"]),
  disabled: z.boolean(),
  sponsor_user_id: z.string().optional(), // the accountable human; absent only on older agents
  created_at: z.string(),
  secret: z.string().optional(), // only in the create response
});
export type Agent = z.infer<typeof agentSchema>;

const agentList = strictly<Answer<"/v1/organizations/{organizationID}/agents">>()(
  z.object({ items: z.array(agentSchema) }),
);
const createdAgentSchema = strictly<Answer<"/v1/organizations/{organizationID}/agents", "post">>()(
  agentSchema.extend({ secret: z.string().min(1) }),
);

export function useAgents() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: developerKeys.agents(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/agents", {
        path: { organizationID: organizationId ?? "" },
        schema: agentList,
      }),
    enabled: !!organizationId,
  });
}

export function useCreateAgent() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (body: {
      name: string;
      scopes: string[];
      token_ttl_seconds: number;
      sponsor_user_id: string;
    }) =>
      backend.post("/v1/organizations/{organizationID}/agents", {
        path: { organizationID: organizationId ?? "" },
        body,
        schema: createdAgentSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(organizationId) }),
    meta: { successMessage: "developer:toast.agentCreated", silentError: true }, // the form shows the error
  });
}

export function useDeleteAgent() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/agents/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(organizationId) }),
    meta: { successMessage: "developer:toast.agentDeleted" },
  });
}

export function useSetAgentDisabled() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      backend.patch("/v1/organizations/{organizationID}/agents/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body: { disabled },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(organizationId) }),
    meta: { successMessage: "developer:toast.agentStatusUpdated" },
  });
}

export function useKillAllAgents() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      backend.post("/v1/organizations/{organizationID}/agents/kill-all", {
        path: { organizationID: organizationId ?? "" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(organizationId) }),
    meta: { successMessage: "developer:toast.allAgentAccessRevoked" },
  });
}

/** Lists the agents a user sponsors, e.g. to preview a sponsor transfer. */
export function useAgentsSponsoredBy(userId: string | null) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: developerKeys.sponsoredAgents(organizationId, userId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/agents/sponsored-by/{userID}", {
        path: { organizationID: organizationId ?? "", userID: userId ?? "" },
      }),
    enabled: !!organizationId && !!userId,
  });
}

/**
 * Reassigns every agent sponsored by `fromUserId` to `toUserId` in one call, so a departing
 * sponsor leaves no orphaned agents.
 */
export function useTransferSponsor() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) =>
      backend.post("/v1/organizations/{organizationID}/agents/sponsored-by/{userID}/transfer", {
        path: { organizationID: organizationId ?? "", userID: fromUserId },
        body: { to_user_id: toUserId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(organizationId) }),
    meta: { successMessage: "developer:toast.sponsorTransferred" },
  });
}

/**
 * OAuth clients with a token-exchange grant that nobody registered or reviewed ("shadow AI"). The
 * same entry the authentication module's review mutation refreshes; `enabled` keeps the call from
 * people who can't read connections.
 */
export function useUnmanagedClients(enabled: boolean) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.shadowAi(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/oidc/clients/shadow-ai", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}
