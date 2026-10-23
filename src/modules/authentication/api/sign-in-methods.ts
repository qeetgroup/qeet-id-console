// How many ways the signed-in account can sign in. The server refuses to remove the last one
// (auth.last_sign_in_method); this lets the security page disable and explain that beforehand.

import { type QueryClient, useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { authKeys } from "./keys";

export interface SignInMethods {
  password: boolean;
  passkeys: number;
  linked_identities: number;
  total: number;
}

export function useSignInMethods() {
  return useQuery({
    queryKey: authKeys.signInMethods(),
    queryFn: () => api<SignInMethods>("/v1/auth/sign-in-methods"),
    staleTime: 30_000,
    meta: { silent: true },
  });
}

/** True when removing one more way to sign in would leave the account with none. */
export function isLastSignInMethod(methods: SignInMethods | undefined): boolean {
  return methods !== undefined && methods.total <= 1;
}

/** Call after adding or removing a way to sign in. */
export function refreshSignInMethods(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: authKeys.signInMethods() });
}
