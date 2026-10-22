// OIDC / OAuth 2.0 client (application) administration. Clients are registered
// per tenant; the list/read/update/rotate endpoints are tenant-scoped while
// create/delete operate on the global /v1/oidc/clients collection (the body /
// the row already carries the tenant). Client secrets are returned exactly
// once (on create + on rotate) and are bcrypt-hashed server-side after that —
// surface them via CopyableSecret immediately; they can't be re-read.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export const OIDC_CLIENTS_KEY = ["oidc-clients"] as const;

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface OidcClient {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  type: "public" | "confidential";
  redirect_uris: string[];
  post_logout_uris?: string[] | null;
  grant_types: string[];
  scopes: string[];
  created_at: string;
  /** When a confidential app's exemption from sending a proof key (and a nonce) ends; null: none. */
  pkce_exempt_until?: string | null;
}

/** How soon before its end an exemption is flagged as ending. */
export const PKCE_EXEMPTION_ENDING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether an app must send a proof key (PKCE, S256) and a nonce on every
 * sign-in, the server's rule for every app, or holds an exemption until a date.
 * A public app never does; an exemption that has ended is reported as such, so
 * its owner can see why sign-ins now fail.
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

export interface CreateOidcResponse {
  client: OidcClient;
  client_secret: string;
  warning: string;
}

export interface UpdateOidcInput {
  name?: string;
  redirect_uris?: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
}

export interface RotateSecretResponse {
  client_secret: string;
  warning: string;
}

/**
 * A confidential application's wrong-secret lockout (server QTID-215): the
 * lockout in force, if any, and its recent failed authentications, each with
 * its time and the caller's address. No secret material is ever recorded.
 */
export interface ClientAuthFailures {
  locked_until: string | null;
  items: { at: string; ip: string; reason: string }[];
}

export function useClientAuthFailures(clientRowId: string | undefined, enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...OIDC_CLIENTS_KEY, tenantId, clientRowId, "auth-failures"],
    enabled: !!tenantId && !!clientRowId && enabled,
    queryFn: () =>
      api<ClientAuthFailures>(`/v1/tenants/${tenantId}/oidc/clients/${clientRowId}/auth-failures`),
  });
}

export function useOidcClients() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...OIDC_CLIENTS_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: OidcClient[] }>(`/v1/tenants/${tenantId}/oidc/clients`),
  });
}

export function useOidcClient(id: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["oidc-client", tenantId, id],
    enabled: !!tenantId && !!id,
    queryFn: () => api<OidcClient>(`/v1/tenants/${tenantId}/oidc/clients/${id}`),
  });
}

export function useCreateOidcClient() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOidcInput) =>
      api<CreateOidcResponse>("/v1/oidc/clients", {
        method: "POST",
        body: { tenant_id: tenantId, ...input },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: OIDC_CLIENTS_KEY }),
    meta: { successMessage: "Application registered" },
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
      qc.invalidateQueries({ queryKey: OIDC_CLIENTS_KEY });
      qc.invalidateQueries({ queryKey: ["oidc-client"] });
    },
    meta: { successMessage: "Application updated" },
  });
}

export function useDeleteOidcClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/oidc/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: OIDC_CLIENTS_KEY }),
    meta: { successMessage: "Application deleted" },
  });
}

export function useRotateClientSecret(id: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<RotateSecretResponse>(`/v1/tenants/${tenantId}/oidc/clients/${id}/rotate-secret`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: OIDC_CLIENTS_KEY }),
    meta: { successMessage: "Client secret rotated" },
  });
}

/** An OIDC client that picked up a machine grant type (client_credentials /
 * token-exchange) without going through the agents/service-accounts registry
 * — i.e. a piece of software that can act without a human, unmanaged. */
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
    queryKey: ["oidc-shadow-ai", tenantId],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oidc-shadow-ai"] }),
    meta: { successMessage: "Acknowledged" },
  });
}
