import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";
import { isOneOf } from "@/shared/utils/one-of";
import { useOrganizationId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

import { userKeys } from "./keys";

type SuspendedAnswer = Answer<"/v1/users/suspended">;
export type SuspendedDirectoryUser = SuspendedAnswer["items"][number];
/** Every suspended person the filters match, up to SUSPENDED_CAP; `complete` is false past it. */
export type SuspendedUsersPage = Omit<SuspendedAnswer, "next_cursor"> & {
  complete: boolean;
};
export type SuspendedFilters = {
  q: string;
  reason: string;
  source: string;
  team: string;
  risk: string;
  review: string;
};
export const DEFAULT_SUSPENDED_FILTERS: SuspendedFilters = {
  q: "",
  reason: "",
  source: "",
  team: "",
  risk: "",
  review: "",
};
/** The most the list reads, 200 a page; the page pages through them itself. */
export const SUSPENDED_CAP = 2000;
const SUSPENDED_PAGE = 200;
export const SUSPENSION_REASONS = [
  "unspecified",
  "provider",
  "suspicious_activity",
  "policy_violation",
  "account_compromise",
  "offboarding",
  "inactive",
  "other",
] as const;
/** What a review sets: why they're suspended, how risky they are, and whether it's been looked at. */
export type SuspensionReview = Body<"/v1/users/{id}/suspension", "put">;
// The list reads "" as no filter; the server takes a filter's absence, and refuses a value it lacks.
function suspendedQuery(filters: SuspendedFilters) {
  return {
    q: filters.q || undefined,
    reason: filters.reason || undefined,
    source: filters.source || undefined,
    team: filters.team || undefined,
    risk: isOneOf(RISKS, filters.risk) ? filters.risk : undefined,
    review: isOneOf(REVIEWS, filters.review) ? filters.review : undefined,
  };
}
const RISKS = ["unknown", "low", "medium", "high"] as const;
const REVIEWS = ["pending", "reviewed", "external"] as const;

export function useSuspendedUsers(filters: SuspendedFilters) {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  return useQuery({
    queryKey: [...userKeys.suspended(organizationId), filters],
    queryFn: async ({ signal }): Promise<SuspendedUsersPage> => {
      let cursor: string | undefined;
      let first: SuspendedUsersPage | undefined;
      do {
        const { next_cursor, ...page } = await backend.get("/v1/users/suspended", {
          query: { ...suspendedQuery(filters), limit: SUSPENDED_PAGE, cursor },
          signal,
        });
        first = first
          ? { ...first, items: [...first.items, ...page.items] }
          : { ...page, complete: true };
        cursor = next_cursor || undefined;
      } while (cursor && first.items.length < SUSPENDED_CAP);
      return { ...first, complete: !cursor };
    },
    enabled: !!organizationId && access.can("user.read"),
    staleTime: 15_000,
  });
}

/** One call per person, for the list's bulk actions to fan out (see people-bulk.tsx). */
export const suspensionCalls = {
  reactivate: (userId: string) =>
    backend.post("/v1/users/{id}/reactivate", { path: { id: userId } }),
  review: (userId: string, review: SuspensionReview) =>
    backend.put("/v1/users/{id}/suspension", { path: { id: userId }, body: review }),
};

export function useReactivateUsers() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await suspensionCalls.reactivate(id);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.organization(organizationId) });
    },
    meta: { successMessage: "users:toast.usersReactivated", silentError: true }, // the page shows the error
  });
}

export function useReviewSuspension() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, review }: { id: string; review: SuspensionReview }) =>
      suspensionCalls.review(id, review),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userKeys.suspended(organizationId) }),
    meta: { successMessage: "users:toast.reviewSaved", silentError: true }, // the page shows the error
  });
}
