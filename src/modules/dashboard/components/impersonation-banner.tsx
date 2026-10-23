import { Button } from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { LogOutIcon, UserCogIcon } from "@qeetrix/icons";

import { api } from "@/platform/api/client";
import { useImpersonationActor, useLogout } from "@/platform/auth/session";

/**
 * Renders a deliberately loud sticky banner while the access token carries an RFC 8693 `act` claim
 * (an admin acting as another user), so they can't forget; renders nothing otherwise.
 */
export function ImpersonationBanner() {
  const actor = useImpersonationActor();
  const logout = useLogout();

  // A failed exit call is ignored: a logout always follows, so the admin signs in again as
  // themselves. Silent, since the reload is feedback enough.
  const exit = useMutation({
    mutationFn: () =>
      api<void>("/v1/admin/impersonate/exit", { method: "POST" }).catch(() => undefined),
    onSettled: () => logout.mutate(),
    meta: { silent: true },
  });

  if (!actor) return null;

  const adminLabel = actor.actorDisplayName || actor.actorEmail || actor.actorSubject;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-rose-700 bg-rose-600 px-4 py-2 text-sm text-white shadow-sm dark:border-rose-500 dark:bg-rose-700"
    >
      <div className="flex min-w-0 items-center gap-2">
        <UserCogIcon className="size-4 shrink-0" />
        <span className="truncate">
          You are impersonating <strong>{actor.targetSubject}</strong>
          <span className="opacity-80"> — signed in as {adminLabel}.</span>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exit.mutate()}
        disabled={exit.isPending}
        className="border-white/40 bg-white/10 text-white hover:bg-white/20"
      >
        <LogOutIcon /> Exit impersonation
      </Button>
    </div>
  );
}
