import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

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
    queryKey: ["users", "suspended", tenantId, filters],
    queryFn: () => api("/v1/users/suspended", { query: filters, schema: suspendedPageSchema }),
    enabled: !!tenantId && access.can("user.read"),
    staleTime: 15_000,
  });
}

export function useReactivateUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await api(`/v1/users/${id}/reactivate`, { method: "POST" });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user-stats"] });
    },
  });
}

export function useReviewSuspension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, review }: { id: string; review: SuspensionReview }) =>
      api(`/v1/users/${id}/suspension`, { method: "PUT", body: review }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "suspended"] }),
  });
}

export async function fetchSuspendedExport(filters: SuspendedFilters) {
  const records: SuspendedDirectoryUser[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await api("/v1/users/suspended", {
      query: { ...filters, limit: 100, offset },
      schema: suspendedPageSchema,
    });
    if (page.total > 10000)
      throw new Error("Narrow the filters before exporting more than 10,000 records.");
    records.push(...page.items);
    if (records.length >= page.total || !page.items.length) break;
  }
  return records;
}

export function safeSuspendedCsvValue(value: string | null): string {
  if (!value) return "";
  return /^[=+@-]/.test(value.trimStart()) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}
