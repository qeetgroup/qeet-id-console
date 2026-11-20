// Invitations: accepting one by its emailed link, and the signed-in user's own pending ones.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import type { Answer } from "@/platform/api/contract";

import { isMfaChallenge, type LoginResponse, type SessionResponse } from "./flows-session";
import { authKeys } from "./keys";

/**
 * Accepts an organization invite anonymously: exchanges the emailed token and a chosen password
 * for a session (the backend creates the user and grants the invited role), then opens the
 * dashboard. An organization that asks for a second factor answers a challenge instead, which
 * the page carries on with.
 */
export function useAcceptInvite() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (in_: {
      token: string;
      password: string;
      display_name?: string;
    }): Promise<LoginResponse> =>
      backend.post("/v1/invites/accept", {
        // The server takes an empty name as none.
        body: { ...in_, display_name: in_.display_name ?? "" },
        anonymous: true,
      }),

    onSuccess: (res) => {
      if (isMfaChallenge(res)) return;
      void navigate({ to: "/" });
    },
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
    mutationFn: async (token: string): Promise<SessionResponse> =>
      backend.post("/v1/me/invites/accept", { body: { token } }),
    onSuccess: () => {
      if (typeof window !== "undefined") window.location.assign("/");
    },
    meta: { successMessage: "authentication:toast.invitationAccepted", silentError: true },
  });
}

/**
 * What an invitation link names, before the invitee chooses how to accept: `account_exists` when
 * the address has an account (sign in and accept as yourself), and the `methods` a new one may use.
 */
export type InvitePreview = Answer<"/v1/invites/lookup", "post">;

/** Looks up an invitation by its emailed token, sent in the body rather than the URL. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: authKeys.invitePreview(token),
    queryFn: () =>
      backend.post("/v1/invites/lookup", {
        body: { token },
        anonymous: true,
      }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
}

/** A pending invitation addressed to the signed-in user's email. */
export type ReceivedInvite = Answer<"/v1/me/invites">["items"][number];

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
        return await backend.get("/v1/me/invites");
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
      backend.post("/v1/me/invites/{id}/decline", { path: { id: inviteId } }),
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
    mutationFn: async (inviteId: string): Promise<SessionResponse> =>
      backend.post("/v1/me/invites/{id}/accept", { path: { id: inviteId } }),
    onSuccess: () => {
      if (typeof window !== "undefined") window.location.assign("/");
    },
    meta: { silent: true }, // the picker shows a failure in place; success reloads into it
  });
}
