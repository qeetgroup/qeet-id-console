// When the retention window makes each deleted person due. Pure, so it's tested on its own.

import type { DeletedUser } from "@/modules/users";

const DAY = 86_400_000;

/** When `user` is removed for good under a window of `days`: their deletion plus the window. */
export const dueAt = (user: Pick<DeletedUser, "deleted_at">, days: number) =>
  Date.parse(user.deleted_at) + days * DAY;

/** How many of `deleted` a window of `days` makes due at `now`. */
export function dueCount(deleted: readonly DeletedUser[], days: number, now: number): number {
  return deleted.filter((u) => dueAt(u, days) <= now).length;
}

/** The next person the window makes due after `now`, and when. */
export function nextDue(
  deleted: readonly DeletedUser[],
  days: number,
  now: number,
): { user: DeletedUser; at: number } | null {
  let next: { user: DeletedUser; at: number } | null = null;
  for (const user of deleted) {
    const at = dueAt(user, days);
    if (at > now && (!next || at < next.at)) next = { user, at };
  }
  return next;
}
