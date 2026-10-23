// Sign-up, email verification and change, and the signed-in user's password.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { ApiError, api } from "@/platform/api/client";

import type { SessionResponse, User } from "./flows-session";
import { authKeys } from "./keys";
import { refreshSignInMethods } from "./sign-in-methods";

type SignupInput = {
  email: string;
  password: string;
  display_name?: string;
};

/**
 * A tenant-less sign-up's result. The BFF keeps the tokens; the user and safe session ids remain
 * for the email verification step.
 */
export type SignupResponse = SessionResponse & {
  user: User;
};

/**
 * Signs up into a new tenant-less server session, then runs `opts.onSuccess` if given (e.g. to
 * start email verification) or opens the dashboard.
 */
export function useSignup(opts?: { onSuccess?: (res: SignupResponse) => void }) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (in_: SignupInput) =>
      api<SignupResponse>("/v1/auth/signup", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),
    onSuccess: (res) => {
      if (opts?.onSuccess) {
        opts.onSuccess(res);
      } else {
        navigate({ to: "/" });
      }
    },
    meta: {
      successMessage: "authentication:toast.accountCreatedSuccessfully",
      successDescription: "authentication:toast.checkEmailForCode",
    },
  });
}

/** Sends a code to the user's address on file; useConfirmEmailVerification checks it. */
export function useStartEmailVerification() {
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ message: string }>(`/v1/users/${userId}/verify/email/start`, {
        method: "POST",
        body: {},
      }),
    meta: { successMessage: "authentication:toast.codeSentToEmail", silentError: true },
  });
}

/**
 * Sends a code to a *new* address; confirming it with useConfirmEmailChange makes it the sign-in
 * email.
 */
export function useStartEmailChange() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ message: string }>("/v1/me/email/change/start", { method: "POST", body: { email } }),
    meta: { successMessage: "authentication:toast.codeSentToNewAddress", silentError: true },
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: (code: string) =>
      api<{ message: string; email: string }>("/v1/me/email/change/confirm", {
        method: "POST",
        body: { code },
      }),
    meta: { successMessage: "authentication:toast.emailAddressUpdated", silentError: true },
  });
}

/** Returns whether the current account has a password (rather than social or passkey only). */
export function usePasswordStatus() {
  return useQuery({
    queryKey: authKeys.passwordStatus(),
    queryFn: async (): Promise<{ has_password: boolean }> => {
      try {
        return await api<{ has_password: boolean }>("/v1/auth/password");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return { has_password: true }; // assume password until proven otherwise
        }
        throw err;
      }
    },
    meta: { silent: true },
    staleTime: 60_000,
  });
}

/**
 * Changes or sets the signed-in user's password. `current_password` is required only when the
 * account has one; a social or passkey account sets a first password by leaving it empty.
 */
export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { current_password: string; new_password: string }) =>
      api<{ message: string }>("/v1/auth/password", { method: "POST", body: in_ }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.passwordStatus() });
      return refreshSignInMethods(qc); // setting a first password adds a way to sign in
    },
    meta: { silent: true }, // the page words the outcome: changed, or set for the first time
  });
}

export function useConfirmEmailVerification() {
  return useMutation({
    mutationFn: (in_: { userId: string; code: string }) =>
      api<{ message: string }>(`/v1/users/${in_.userId}/verify/email/confirm`, {
        method: "POST",
        body: { code: in_.code },
      }),
    meta: { successMessage: "authentication:toast.emailVerified", silentError: true },
  });
}
