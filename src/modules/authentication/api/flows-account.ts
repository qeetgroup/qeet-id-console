// Sign-up, email verification and change, and the signed-in user's password.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { assured } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import type { Answer } from "@/platform/api/contract";

import { authKeys } from "./keys";
import { refreshSignInMethods } from "./sign-in-methods";

type SignupInput = {
  email: string;
  password: string;
  display_name?: string;
};

// The ids the verification step needs, always sent though the document leaves them optional.
const signedUp = assured<Answer<"/v1/auth/signup", "post">>()("user_id", "session_id");

/**
 * A tenant-less sign-up's result. The BFF keeps the tokens; the user and safe session ids remain
 * for the email verification step.
 */
export type SignupResponse = Omit<
  import("zod").output<typeof signedUp>,
  "access_token" | "refresh_token"
>;

/**
 * Signs up into a new tenant-less server session, then runs `opts.onSuccess` if given (e.g. to
 * start email verification) or opens the dashboard.
 */
export function useSignup(opts?: { onSuccess?: (res: SignupResponse) => void }) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (in_: SignupInput): Promise<SignupResponse> =>
      backend.post("/v1/auth/signup", { body: in_, anonymous: true, schema: signedUp }),
    onSuccess: (res) => {
      if (opts?.onSuccess) {
        opts.onSuccess(res);
      } else {
        void navigate({ to: "/" });
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
      backend.post("/v1/users/{id}/verify/email/start", { path: { id: userId } }),
    meta: { successMessage: "authentication:toast.codeSentToEmail", silentError: true },
  });
}

/**
 * Sends a code to a *new* address; confirming it with useConfirmEmailChange makes it the sign-in
 * email.
 */
export function useStartEmailChange() {
  return useMutation({
    mutationFn: (email: string) => backend.post("/v1/me/email/change/start", { body: { email } }),
    meta: { successMessage: "authentication:toast.codeSentToNewAddress", silentError: true },
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: (code: string) => backend.post("/v1/me/email/change/confirm", { body: { code } }),
    meta: { successMessage: "authentication:toast.emailAddressUpdated", silentError: true },
  });
}

/** Returns whether the current account has a password (rather than social or passkey only). */
export function usePasswordStatus() {
  return useQuery({
    queryKey: authKeys.passwordStatus(),
    queryFn: async (): Promise<{ has_password: boolean }> => {
      try {
        return await backend.get("/v1/auth/password");
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
      backend.post("/v1/auth/password", { body: in_ }),
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
      backend.post("/v1/users/{id}/verify/email/confirm", {
        path: { id: in_.userId },
        body: { code: in_.code },
      }),
    meta: { successMessage: "authentication:toast.emailVerified", silentError: true },
  });
}
