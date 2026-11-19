// Invitations: an email with a one-time link that makes the invitee a member of an organization,
// with a role, once accepted.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { userKeys } from "./keys";

/** An invitation as the organisation's list has it; never its token. */
export type Invitation = Answer<"/v1/organizations/{organizationID}/invites">["items"][number];

export const invitationQueries = {
  list: (organizationId: string | null) =>
    queryOptions({
      queryKey: userKeys.invitations(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/invites", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
    }),
};

export function useInvitations(enabled = true) {
  const options = invitationQueries.list(useOrganizationId());
  return useQuery({ ...options, enabled: options.enabled && enabled });
}

export interface CreateInvitationInput {
  organization_id: string; // the organization the invitee joins; any the caller belongs to
  email: string;
  role_id?: string;
}

// The server takes role_id always, null for none; the answer never carries the token.
const createInvite = ({ role_id, ...rest }: CreateInvitationInput) =>
  backend.post("/v1/invites", { body: { ...rest, role_id: role_id ?? null } });

/** One call per invitation, for bulk actions and several addresses at once to fan out. */
export const inviteCalls = {
  create: createInvite,
  resend: (id: string) => backend.post("/v1/invites/{id}/resend", { path: { id } }),
  revoke: (id: string) => backend.delete("/v1/invites/{id}", { path: { id } }),
};

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInvite,
    onSuccess: (_, { organization_id }) =>
      qc.invalidateQueries({ queryKey: userKeys.invitations(organization_id) }),
    meta: { successMessage: "users:toast.invitationSent", silentError: true }, // the sheet shows the error
  });
}

/** Re-sends an invitation with a fresh link and expiry, returning it to pending; only email has the link. */
export function useResendInvitation() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.post("/v1/invites/{id}/resend", { path: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.invitations(organizationId) }),
    meta: { successMessage: "users:toast.invitationReSent" },
  });
}

export function useRevokeInvitation() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/invites/{id}", { path: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.invitations(organizationId) }),
    meta: { successMessage: "users:toast.invitationRevoked" },
  });
}
