// Invitations: accepting one by its emailed link, and the signed-in user's own pending ones.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { ApiError, api } from "@/platform/api/client";

import type { SessionResponse } from "./flows-session";
import { authKeys } from "./keys";

/**
 * Accepts an organization invite anonymously: exchanges the emailed token and a chosen password
 * for a session (the backend creates the user and grants the invited role), then opens the
 * dashboard.
 */
export function useAcceptInvite() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (in_: { token: string; password: string; display_name?: string }) =>
      api<SessionResponse>("/v1/invites/accept", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),

    onSuccess: () => navigate({ to: "/" }),
    // The invitation page shows the failure itself, so the global error toast is off.
    meta: { successMessage: "authentication:toast.invitationAccepted", silentError: true },
  });
}

/**
 * Accepts an invitation link as the signed-in account: the server joins it to the invited
 * organization and returns a session there, then the console reloads into it.
 */
export function useAcceptInviteAsMe() {
  return useMutation({
    mutationFn: (token: string) =>
      api<SessionResponse>("/v1/me/invites/accept", { method: "POST", body: { token } }),
    onSuccess: () => {
      if (typeof window !== "undefined") window.location.assign("/");
    },
    meta: { successMessage: "authentication:toast.invitationAccepted", silentError: true },
  });
}

/** What an invitation link names, before the invitee chooses how to accept. */
export interface InvitePreview {
  organization: { name: string; slug: string };
  email: string;
  expires_at: string;
  account_exists: boolean; // An account already holds the address: sign in and accept as yourself
  methods: { password: boolean; passkey: boolean }; // The ways a new account may accept
}

/** Looks up an invitation by its emailed token, sent in the body rather than the URL. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: authKeys.invitePreview(token),
    queryFn: () =>
      api<InvitePreview>("/v1/invites/lookup", {
        method: "POST",
        body: { token },
        anonymous: true,
      }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
}

/** A pending invitation addressed to the signed-in user's email. */
export interface ReceivedInvite {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  email: string;
  role_id?: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Returns pending invitations addressed to the current user's email, so the organisation picker
 * can offer them, not only the email link: to a new account first, and to a member as well.
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: authKeys.invitations(),
    // A server without this endpoint (404/501) yields no invites: the organisation picker asks on
    // every visit, where an error toast would be noise.
    queryFn: async (): Promise<{ items: ReceivedInvite[] }> => {
      try {
        return await api<{ items: ReceivedInvite[] }>("/v1/me/invites");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return { items: [] };
        }
        throw err;
      }
    },
    meta: { silent: true },
    retry: false,
  });
}

/** Declines a pending invitation addressed to the current user. */
export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<{ message: string }>(`/v1/me/invites/${inviteId}/decline`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.invitations() }),
    meta: { successMessage: "authentication:toast.invitationDeclined" },
  });
}

/**
 * Accepts a pending invitation as the *existing* signed-in account (no new user or password),
 * then reloads into the joined organization.
 */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<SessionResponse>(`/v1/me/invites/${inviteId}/accept`, {
        method: "POST",
        body: {},
      }),
    onSuccess: () => {
      if (typeof window !== "undefined") window.location.assign("/");
    },
    meta: { silent: true }, // the picker shows a failure in place; success reloads into it
  });
}
