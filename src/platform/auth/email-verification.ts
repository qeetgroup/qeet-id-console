import type { QueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import type { Me } from "@/platform/auth/session";

/** Shared with `useMe()` so a guard hit costs one request, not two. */
export function meQueryOptions(userId: string) {
  return {
    queryKey: ["me", userId] as const,
    queryFn: () => api<Me>("/v1/me"),
    staleTime: 60_000,
  };
}

/**
 * Route-guard read of the signed-in user's email verification state, used to
 * keep an unverified account on /verify-email instead of the console.
 *
 * Fails OPEN. If `/v1/me` can't be reached we report "verified" and let the
 * navigation through, because this guard is UX rather than security (ADR-0003 —
 * the backend is the authority, and `POST /v1/tenants` enforces the real gate
 * server-side). Failing closed would turn any backend blip into a console-wide
 * lockout. `VerifyEmailBanner` stays mounted as the visible fallback for
 * exactly that window.
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
