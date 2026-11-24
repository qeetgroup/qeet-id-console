// How many ways the signed-in account can sign in. The server refuses to remove the last one
// (auth.last_sign_in_method); this lets the security page disable and explain that beforehand.

import { type QueryClient, useQuery } from "@tanstack/react-query";
import { authKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

export type SignInMethods = Answer<"/v1/auth/sign-in-methods">;

export function useSignInMethods() {
  return useQuery({
    queryKey: authKeys.signInMethods(),
    queryFn: () => backend.get("/v1/auth/sign-in-methods"),
    staleTime: 30_000,
    meta: { silent: true },
  });
}

/**
 * True when removing one more way to sign in would leave the account with none. Without a count
 * nothing is held back: the server still refuses the last one, and the page says why.
 */
export function isLastSignInMethod(methods: SignInMethods | undefined): boolean {
  return methods?.total !== undefined && methods.total <= 1;
}

/** Call after adding or removing a way to sign in. */
export function refreshSignInMethods(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: authKeys.signInMethods() });
}
