// Invitations: an email with a one-time link that makes the invitee a member of an organization,
// with a role, once accepted.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { userKeys } from "./keys";

export interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  role_id?: string | null;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
}

export const invitationQueries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: userKeys.invitations(tenantId),
      queryFn: () => api<{ items: Invitation[] }>(`/v1/tenants/${tenantId}/invites`),
      enabled: !!tenantId,
    }),
};

export function useInvitations(enabled = true) {
  const options = invitationQueries.list(useTenantId());
  return useQuery({ ...options, enabled: options.enabled && enabled });
}

export interface CreateInvitationInput {
  tenant_id: string; // the organization the invitee joins; any the caller belongs to
  email: string;
  role_id?: string;
}

/** One call per invitation, for bulk actions and several addresses at once to fan out. */
export const inviteCalls = {
  create: (body: CreateInvitationInput) =>
    api<{ invite: Invitation }>("/v1/invites", { method: "POST", body }), // never the token
  resend: (id: string) =>
    api<{ invite: Invitation }>(`/v1/invites/${id}/resend`, { method: "POST" }),
  revoke: (id: string) => api<void>(`/v1/invites/${id}`, { method: "DELETE" }),
};

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvitationInput) =>
      api<{ invite: Invitation }>("/v1/invites", { method: "POST", body }), // never the token
    onSuccess: (_, { tenant_id }) =>
      qc.invalidateQueries({ queryKey: userKeys.invitations(tenant_id) }),
    meta: { successMessage: "users:toast.invitationSent", silentError: true }, // the sheet shows the error
  });
}

/** Re-sends an invitation with a fresh link and expiry, returning it to pending; only email has the link. */
export function useResendInvitation() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ invite: Invitation }>(`/v1/invites/${id}/resend`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.invitations(tenantId) }),
    meta: { successMessage: "users:toast.invitationReSent" },
  });
}

export function useRevokeInvitation() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.invitations(tenantId) }),
    meta: { successMessage: "users:toast.invitationRevoked" },
  });
}
