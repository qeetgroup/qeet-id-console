// The recycle bin: when each deleted person is purged, and the filters in the page address. Pure,
// so the page and its tests share it.
import { z } from "zod";

import { searchEnum, searchText } from "@/shared/utils/search-params";

import type { DeletedUser } from "./api/users";
import { DAY_MS } from "./people-model";

/** When they're purged: within 7 or 30 days, or later. */
export const PURGE_WINDOWS = ["7", "30", "later"] as const;

/** The tab's address: `?q=…&purge=…&by=…`. */
export const deletedSearch = z.object({
  q: searchText(),
  purge: searchEnum(PURGE_WINDOWS),
  by: searchText(),
});
export type DeletedFilters = z.infer<typeof deletedSearch>;

/** When a deleted person is purged for good, or null when nothing purges them automatically. */
export function purgeAt(
  user: Pick<DeletedUser, "deleted_at">,
  keepDays: number | null,
): number | null {
  return keepDays === null ? null : Date.parse(user.deleted_at) + keepDays * DAY_MS;
}

/** Whole days until the purge, 0 when it's due. */
export const daysUntil = (at: number, now: number) => Math.max(0, Math.ceil((at - now) / DAY_MS));

/** Whether a deleted person is in the list the filters and search leave. */
export function matchesDeleted(
  user: DeletedUser,
  filters: DeletedFilters,
  keepDays: number | null,
  now: number,
): boolean {
  if (filters.by && user.deleted_by !== filters.by) return false;
  if (filters.purge) {
    const at = purgeAt(user, keepDays);
    if (at === null) return false;
    const left = daysUntil(at, now);
    if (filters.purge === "later" ? left <= 30 : left > Number(filters.purge)) return false;
  }
  const query = filters.q?.trim().toLowerCase();
  if (!query) return true;
  return [user.display_name, user.email].some((field) => field?.toLowerCase().includes(query));
}
