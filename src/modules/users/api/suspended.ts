import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

import { userKeys } from "./keys";

const suspendedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  team: z.string(),
  reason: z.string(),
  source: z.string(),
  risk: z.enum(["unknown", "low", "medium", "high"]),
  review: z.enum(["pending", "reviewed", "external"]),
  suspended_at: z.string().nullable(),
  last_sign_in: z.string().nullable(),
  can_manage: z.boolean(),
});
const suspendedPageSchema = z.object({
  items: z.array(suspendedUserSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  summary: z.object({
    total: z.number(),
    high_risk: z.number(),
    policy: z.number(),
    manual: z.number(),
    pending: z.number(),
  }),
  reasons: z.array(z.object({ key: z.string(), count: z.number() })),
  risks: z.array(z.object({ key: z.string(), count: z.number() })),
  queue: z.array(suspendedUserSchema),
  teams: z.array(z.string()),
});

export type SuspendedDirectoryUser = z.infer<typeof suspendedUserSchema>;
export type SuspendedUsersPage = z.infer<typeof suspendedPageSchema>;
export type SuspendedFilters = {
  q: string;
  reason: string;
  source: string;
  team: string;
  risk: string;
  review: string;
  limit: number;
  offset: number;
};
export const DEFAULT_SUSPENDED_FILTERS: SuspendedFilters = {
  q: "",
  reason: "",
  source: "",
  team: "",
  risk: "",
  review: "",
  limit: 25,
  offset: 0,
};
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
export type SuspensionReview = { reason: string; risk: string; review: "pending" | "reviewed" };

export function useSuspendedUsers(filters: SuspendedFilters) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: [...userKeys.suspended(tenantId), filters],
    queryFn: () => api("/v1/users/suspended", { query: filters, schema: suspendedPageSchema }),
    enabled: !!tenantId && access.can("user.read"),
    staleTime: 15_000,
  });
}

/** One call per person, for the list's bulk actions to fan out (see people-bulk.tsx). */
export const suspensionCalls = {
  reactivate: (userId: string) => api<void>(`/v1/users/${userId}/reactivate`, { method: "POST" }),
  review: (userId: string, review: SuspensionReview) =>
    api<void>(`/v1/users/${userId}/suspension`, { method: "PUT", body: review }),
};

export function useReactivateUsers() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await api(`/v1/users/${id}/reactivate`, { method: "POST" });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.tenant(tenantId) });
    },
    meta: { successMessage: "users:toast.usersReactivated", silentError: true }, // the page shows the error
  });
}

export function useReviewSuspension() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, review }: { id: string; review: SuspensionReview }) =>
      api(`/v1/users/${id}/suspension`, { method: "PUT", body: review }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.suspended(tenantId) }),
    meta: { successMessage: "users:toast.reviewSaved", silentError: true }, // the page shows the error
  });
}
