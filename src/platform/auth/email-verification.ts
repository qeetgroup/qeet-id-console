import type { QueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { type Me, meKeys } from "@/platform/auth/session";

/** Returns the `/v1/me` query, keyed like useMe() so a guard and the page share one request. */
export function meQueryOptions(userId: string) {
  return {
    queryKey: meKeys.user(userId),
    queryFn: () => api<Me>("/v1/me"),
    staleTime: 60_000,
  };
}

/**
 * Returns whether the signed-in user's email is verified, for the guard that holds an unverified
 * account on /verify-email. Fails open: the guard is UX, the backend enforces the real gate, and
 * failing closed would turn a backend blip into a console-wide lockout.
 */
export async function hasVerifiedEmail(
  queryClient: QueryClient,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return true;
  try {
    const me = await queryClient.ensureQueryData(meQueryOptions(userId));
    return !!me.email_verified_at;
  } catch {
    return true;
  }
}
