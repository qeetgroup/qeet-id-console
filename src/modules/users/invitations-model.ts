// What the Invitations tab works out from the organisation's invitations: how long people took to
// join, what's left on a link, the filters in the page address. Pure, so the page and its tests
// share it.
import type { z } from "zod";

import { createIntentSearch } from "@/shared/hooks/use-create-intent";
import { searchEnum, searchText } from "@/shared/utils/search-params";

import type { Invitation } from "./api/invitations";
import { DAY_MS } from "./people-model";

/** How long an invitation's link lasts: the server sets 14 days, and a resend starts it again. */
export const LINK_DAYS = 14;

/** The statuses the list filters by, in the order the band lists them. */
export const INVITE_STATUSES = ["accepted", "pending", "expired", "revoked"] as const;
/** When it was sent: within 7 or 30 days, or longer ago. */
export const SENT_WINDOWS = ["7", "30", "older"] as const;

/** The tab's address: `?q=…&status=…&role=…&sent=…`, and `action=create` for the drawer. */
export const invitationsSearch = createIntentSearch.extend({
  q: searchText(),
  status: searchEnum(INVITE_STATUSES),
  role: searchText(),
  sent: searchEnum(SENT_WINDOWS),
});
export type InvitationsSearch = z.infer<typeof invitationsSearch>;
export type InvitationFilters = Omit<InvitationsSearch, "action">;

/** Days from the email to joining, for an accepted invitation. */
export function joinDays(invite: Pick<Invitation, "accepted_at" | "created_at">): number | null {
  if (!invite.accepted_at) return null;
  return Math.max(0, (Date.parse(invite.accepted_at) - Date.parse(invite.created_at)) / DAY_MS);
}

/** Whole days until the link expires (negative once it has). */
export function daysLeft(invite: Pick<Invitation, "expires_at">, now: number): number {
  return Math.ceil((Date.parse(invite.expires_at) - now) / DAY_MS);
}

/** The middle value, or null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** How many invitations were sent in each of the last `months` months, ending with this one. */
export function sentByMonth(
  invites: readonly Pick<Invitation, "created_at">[],
  now: number,
  months = 15,
) {
  const today = new Date(now);
  return Array.from({ length: months }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() - months + 1 + i, 1).getTime();
    const end = new Date(today.getFullYear(), today.getMonth() - months + 2 + i, 1).getTime();
    return invites.filter((x) => {
      const at = Date.parse(x.created_at);
      return at >= start && at < end;
    }).length;
  });
}

/** Whether an invitation is in the list the filters and search leave. */
export function matchesInvite(
  invite: Invitation,
  filters: InvitationFilters,
  now: number,
): boolean {
  if (filters.status && invite.status !== filters.status) return false;
  if (filters.role && invite.role_id !== filters.role) return false;
  if (filters.sent) {
    const age = now - Date.parse(invite.created_at);
    if (filters.sent === "older" ? age < 30 * DAY_MS : age >= Number(filters.sent) * DAY_MS)
      return false;
  }
  const query = filters.q?.trim().toLowerCase();
  return !query || invite.email.toLowerCase().includes(query);
}

/** What can be done with an invitation: send it again, revoke it, or invite the person afresh. */
export const canResend = (invite: Pick<Invitation, "status">) =>
  invite.status === "pending" || invite.status === "expired";
export const canRevoke = (invite: Pick<Invitation, "status">) => invite.status === "pending";
export const canInviteAgain = (invite: Pick<Invitation, "status">) =>
  invite.status === "revoked" || invite.status === "declined";
