// OIDC client (application) administration: list, read, update and rotate are tenant-scoped;
// create and delete use /v1/oidc/clients. A client secret is returned once, on create or rotate,
// and stored hashed, so show it immediately: it can't be read again.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

const oidcClientSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  client_id: z.string(),
  name: z.string(),
  type: z.enum(["public", "confidential"]),
  redirect_uris: z.array(z.string()),
  post_logout_uris: z.array(z.string()).nullish(),
  grant_types: z.array(z.string()),
  scopes: z.array(z.string()),
  created_at: z.string(),
  // When a confidential app's exemption from sending a proof key and nonce ends; null: none.
  pkce_exempt_until: z.string().nullish(),
});
export type OidcClient = z.infer<typeof oidcClientSchema>;

/** How soon before its end an exemption is flagged as ending. */
export const PKCE_EXEMPTION_ENDING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether an app must send a proof key (PKCE, S256) and a nonce on every sign-in, the server's
 * rule for every app, or holds an exemption until a date. A public app never holds one; an
 * ended exemption is reported as such, so its owner can see why sign-ins now fail.
 */
export type ProofKeyStatus =
  | { kind: "required" }
  | { kind: "exempt"; until: Date; endingSoon: boolean }
  | { kind: "ended"; until: Date };

export function proofKeyStatus(client: OidcClient, now: Date = new Date()): ProofKeyStatus {
  if (client.type !== "confidential" || !client.pkce_exempt_until) return { kind: "required" };
  const until = new Date(client.pkce_exempt_until);
  if (Number.isNaN(until.getTime())) return { kind: "required" };
  if (until.getTime() <= now.getTime()) return { kind: "ended", until };
  return {
    kind: "exempt",
    until,
    endingSoon: until.getTime() - now.getTime() <= PKCE_EXEMPTION_ENDING_SOON_MS,
  };
}

export interface CreateOidcInput {
  name: string;
  type: "public" | "confidential";
  redirect_uris?: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
}

const createOidcResponseSchema = z
  .object({
    client: oidcClientSchema,
    client_secret: z.string().min(1).optional(), // Confidential clients only, shown this once
    warning: z.string().optional(),
  })
  .refine((r) => r.client.type === "public" || r.client_secret !== undefined, {
    message: "A confidential client was created without its secret",
    path: ["client_secret"],
  });
export type CreateOidcResponse = z.infer<typeof createOidcResponseSchema>;

export interface UpdateOidcInput {
  name?: string;
  redirect_uris?: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
}

const rotateSecretResponseSchema = z.object({
  client_secret: z.string().min(1), // Shown this once
  warning: z.string().optional(),
});
export type RotateSecretResponse = z.infer<typeof rotateSecretResponseSchema>;

/** Registers an application; a confidential one's secret is in the response, this once. */
export function createOidcClient(
  tenantId: string | null,
  input: CreateOidcInput,
  signal?: AbortSignal,
): Promise<CreateOidcResponse> {
  return api("/v1/oidc/clients", {
    method: "POST",
    body: { tenant_id: tenantId, ...input },
    schema: createOidcResponseSchema,
    signal,
  });
}

/** Replaces an application's secret; the new one is in the response, this once. */
export function rotateOidcClientSecret(
  tenantId: string | null,
  id: string,
  signal?: AbortSignal,
): Promise<RotateSecretResponse> {
  return api(`/v1/tenants/${tenantId}/oidc/clients/${id}/rotate-secret`, {
    method: "POST",
    schema: rotateSecretResponseSchema,
    signal,
  });
}

/**
 * A confidential application's wrong-secret lockout: the lockout in force, if any, and its recent
 * failed authentications with their time and caller address. No secret material is recorded.
 */
export interface ClientAuthFailures {
  locked_until: string | null;
  items: { at: string; ip: string; reason: string }[];
}

export function useClientAuthFailures(clientRowId: string | undefined, enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.oidcClientFailures(tenantId, clientRowId),
    enabled: !!tenantId && !!clientRowId && enabled,
    queryFn: () =>
      api<ClientAuthFailures>(`/v1/tenants/${tenantId}/oidc/clients/${clientRowId}/auth-failures`),
  });
}

export const oidcClientQueries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: authKeys.oidcClients(tenantId),
      queryFn: () => api<{ items: OidcClient[] }>(`/v1/tenants/${tenantId}/oidc/clients`),
      enabled: !!tenantId,
    }),
};

export function useOidcClients() {
  return useQuery(oidcClientQueries.list(useTenantId()));
}

export function useOidcClient(id: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.oidcClient(tenantId, id),
    enabled: !!tenantId && !!id,
    queryFn: () => api<OidcClient>(`/v1/tenants/${tenantId}/oidc/clients/${id}`),
  });
}

export function useCreateOidcClient() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (input: CreateOidcInput) => createOidcClient(tenantId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oidcClients(tenantId) }),
    meta: { successMessage: "auth:toast.applicationRegistered", silentError: true }, // the sheet shows it
  });
}

export function useUpdateOidcClient(id: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOidcInput) =>
      api<OidcClient>(`/v1/tenants/${tenantId}/oidc/clients/${id}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.oidcClients(tenantId) });
    },
    meta: { successMessage: "auth:toast.applicationUpdated", silentError: true },
  });
}

export function useDeleteOidcClient() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/oidc/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oidcClients(tenantId) }),
    meta: { successMessage: "auth:toast.applicationDeleted" },
  });
}

export function useRotateClientSecret(id: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: () => rotateOidcClientSecret(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oidcClients(tenantId) }),
    meta: { successMessage: "auth:toast.clientSecretRotated" },
  });
}

/**
 * An OIDC client holding a machine grant type (client_credentials, token-exchange) outside the
 * agents and service-accounts registry: unmanaged software that can act without a human.
 */
export interface ShadowAICandidate {
  id: string;
  client_id: string;
  name: string;
  grant_types: string[];
  live_grants: number;
  created_at: string;
}

export function useShadowAICandidates() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.shadowAi(tenantId),
    enabled: !!tenantId,
    queryFn: () =>
      api<{ items: ShadowAICandidate[] }>(`/v1/tenants/${tenantId}/oidc/clients/shadow-ai`),
  });
}

export function useReviewShadowAIClient() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/oidc/clients/${id}/review`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.shadowAi(tenantId) }),
    meta: { successMessage: "auth:toast.acknowledged" },
  });
}
