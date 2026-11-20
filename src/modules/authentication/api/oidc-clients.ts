// OIDC client (application) administration: list, read, update and rotate are tenant-scoped;
// create and delete use /v1/oidc/clients. A client secret is returned once, on create or rotate,
// and stored hashed, so show it immediately: it can't be read again.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer, Schemas } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";

// The server always sends these (internal/federation/oidc/clients.go); the document marks them
// optional.
const oidcClientSchema = strictly<Schemas<"federation">["OIDCClient"]>()(
  z.object({
    id: z.string(),
    organization_id: z.string(),
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
    // The logo and home page the hosted sign-in page shows; "" or absent: none.
    logo_uri: z.string().optional(),
    client_uri: z.string().optional(),
  }),
);
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
  logo_uri?: string; // "" for none
  client_uri?: string; // "" for none
}

const createOidcResponseSchema = strictly<Answer<"/v1/oidc/clients", "post">>()(
  z
    .object({
      client: oidcClientSchema,
      client_secret: z.string().min(1).optional(), // Confidential clients only, shown this once
      warning: z.string().optional(),
    })
    .refine((r) => r.client.type === "public" || r.client_secret !== undefined, {
      message: "A confidential client was created without its secret",
      path: ["client_secret"],
    }),
);
export type CreateOidcResponse = z.infer<typeof createOidcResponseSchema>;

export interface UpdateOidcInput {
  name?: string;
  redirect_uris?: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
  logo_uri?: string; // "" clears it
  client_uri?: string; // "" clears it
}

const rotateSecretResponseSchema = strictly<
  Answer<"/v1/organizations/{organizationID}/oidc/clients/{id}/rotate-secret", "post">
>()(
  z.object({
    client_secret: z.string().min(1), // Shown this once
    warning: z.string().optional(),
  }),
);
export type RotateSecretResponse = z.infer<typeof rotateSecretResponseSchema>;

/** Registers an application; a confidential one's secret is in the response, this once. */
export function createOidcClient(
  organizationId: string | null,
  input: CreateOidcInput,
  signal?: AbortSignal,
): Promise<CreateOidcResponse> {
  return backend.post("/v1/oidc/clients", {
    body: { organization_id: organizationId ?? "", ...input },
    schema: createOidcResponseSchema,
    signal,
  });
}

/** Replaces an application's secret; the new one is in the response, this once. */
export function rotateOidcClientSecret(
  organizationId: string | null,
  id: string,
  signal?: AbortSignal,
): Promise<RotateSecretResponse> {
  return backend.post("/v1/organizations/{organizationID}/oidc/clients/{id}/rotate-secret", {
    path: { organizationID: organizationId ?? "", id },
    schema: rotateSecretResponseSchema,
    signal,
  });
}

/**
 * A confidential application's wrong-secret lockout: the lockout in force, if any, and its recent
 * failed authentications with their time and caller address. No secret material is recorded.
 */
const clientAuthFailures = strictly<
  Answer<"/v1/organizations/{organizationID}/oidc/clients/{id}/auth-failures">
>()(
  z.object({
    locked_until: z.string().nullable(),
    items: z.array(z.object({ at: z.string(), ip: z.string(), reason: z.string() })),
  }),
);
export type ClientAuthFailures = z.infer<typeof clientAuthFailures>;

const oidcClientPage = strictly<Answer<"/v1/organizations/{organizationID}/oidc/clients">>()(
  z.object({ items: z.array(oidcClientSchema), truncated: z.boolean().optional() }),
);

export function useClientAuthFailures(clientRowId: string | undefined, enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.oidcClientFailures(organizationId, clientRowId),
    enabled: !!organizationId && !!clientRowId && enabled,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/oidc/clients/{id}/auth-failures", {
        path: { organizationID: organizationId ?? "", id: clientRowId ?? "" },
        schema: clientAuthFailures,
      }),
  });
}

export const oidcClientQueries = {
  list: (organizationId: string | null) =>
    queryOptions({
      queryKey: authKeys.oidcClients(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/oidc/clients", {
          path: { organizationID: organizationId ?? "" },
          schema: oidcClientPage,
        }),
      enabled: !!organizationId,
    }),
};

export function useOidcClients() {
  return useQuery(oidcClientQueries.list(useOrganizationId()));
}

export function useOidcClient(id: string) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.oidcClient(organizationId, id),
    enabled: !!organizationId && !!id,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/oidc/clients/{id}", {
        path: { organizationID: organizationId ?? "", id },
        schema: oidcClientSchema,
      }),
  });
}

export function useCreateOidcClient() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (input: CreateOidcInput) => createOidcClient(organizationId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oidcClients(organizationId) }),
    meta: { successMessage: "oidc:toast.registered", silentError: true }, // the drawer shows it
  });
}

export function useUpdateOidcClient(id: string) {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOidcInput) =>
      backend.patch("/v1/organizations/{organizationID}/oidc/clients/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body,
        schema: oidcClientSchema,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.oidcClients(organizationId) });
    },
    meta: { silentError: true }, // the drawer says what happened
  });
}

export function useDeleteOidcClient() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/oidc/clients/{id}", { path: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oidcClients(organizationId) }),
    meta: { successMessage: "oidc:toast.deleted" },
  });
}

export function useRotateClientSecret(id: string) {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: () => rotateOidcClientSecret(organizationId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oidcClients(organizationId) }),
    meta: { successMessage: "oidc:toast.secretRotated" },
  });
}

/**
 * An OIDC client holding a token-exchange grant outside the agents and service-accounts registry:
 * unmanaged software that can act without a human. (Applications can't hold client_credentials.)
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
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.shadowAi(organizationId),
    enabled: !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/oidc/clients/shadow-ai", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}

export function useReviewShadowAIClient() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/oidc/clients/{id}/review", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.shadowAi(organizationId) }),
    meta: { successMessage: "authentication:toast.acknowledged" },
  });
}
