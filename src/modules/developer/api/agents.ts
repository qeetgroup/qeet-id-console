// AI agents exchange their secret at POST /v1/agents/token for a short-lived, scoped token marked
// actor_type="agent". The secret is returned only once, on create.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { developerKeys } from "./keys";

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

const createdAgentSchema = agentSchema.extend({ secret: z.string().min(1) });

export function useAgents() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: developerKeys.agents(tenantId),
    queryFn: () => api<{ items: Agent[] }>(`/v1/tenants/${tenantId}/agents`),
    enabled: !!tenantId,
  });
}

export function useCreateAgent() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (body: {
      name: string;
      scopes: string[];
      token_ttl_seconds: number;
      sponsor_user_id: string;
    }) =>
      api(`/v1/tenants/${tenantId}/agents`, { method: "POST", body, schema: createdAgentSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(tenantId) }),
    meta: { successMessage: "developer:toast.agentCreated", silentError: true }, // the form shows the error
  });
}

export function useDeleteAgent() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/agents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(tenantId) }),
    meta: { successMessage: "developer:toast.agentDeleted" },
  });
}

export function useSetAgentDisabled() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      api<void>(`/v1/tenants/${tenantId}/agents/${id}`, {
        method: "PATCH",
        body: { disabled },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(tenantId) }),
    meta: { successMessage: "developer:toast.agentStatusUpdated" },
  });
}

export function useKillAllAgents() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ suspended: number }>(`/v1/tenants/${tenantId}/agents/kill-all`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(tenantId) }),
    meta: { successMessage: "developer:toast.allAgentAccessRevoked" },
  });
}

/** Lists the agents a user sponsors, e.g. to preview a sponsor transfer. */
export function useAgentsSponsoredBy(userId: string | null) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: developerKeys.sponsoredAgents(tenantId, userId),
    queryFn: () => api<{ items: Agent[] }>(`/v1/tenants/${tenantId}/agents/sponsored-by/${userId}`),
    enabled: !!tenantId && !!userId,
  });
}

/**
 * Reassigns every agent sponsored by `fromUserId` to `toUserId` in one call, so a departing
 * sponsor leaves no orphaned agents.
 */
export function useTransferSponsor() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) =>
      api<{ transferred: number }>(
        `/v1/tenants/${tenantId}/agents/sponsored-by/${fromUserId}/transfer`,
        { method: "POST", body: { to_user_id: toUserId } },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.agents(tenantId) }),
    meta: { successMessage: "developer:toast.sponsorTransferred" },
  });
}
