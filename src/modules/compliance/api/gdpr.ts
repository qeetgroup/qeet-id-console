// GDPR erasure requests: each erases one person's personal data once its grace period ends; until
// then it can be withdrawn. Filing needs a step-up; the server keeps the 200 newest.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";
import { isOneOf } from "@/shared/utils/one-of";
import { complianceKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

const PURGE_STATUSES = ["pending", "completed", "cancelled", "quarantined"] as const;

/** `quarantined`: the sweeper found the account no longer belongs here, so it erased nothing. */
export type PurgeStatus = (typeof PURGE_STATUSES)[number];

/** A request's status as the console knows it; the document leaves it a free string. */
export const purgeStatus = (status: string): PurgeStatus | undefined =>
  isOneOf(PURGE_STATUSES, status) ? status : undefined;

/** One erasure request: who asked, why, until when it can be withdrawn, and who it is about. */
export type PurgeRequest = Answer<"/v1/organizations/{organizationID}/gdpr/purge">["items"][number];

/** How long a request waits (gdpr.NewService in the server's bootstrap; not configurable). */
export const ERASURE_GRACE_DAYS = 30;

export function useGdprPurges() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: complianceKeys.gdprPurges(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/gdpr/purge", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
  });
}

export function useCreateGdprPurge() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { user_id: string; reason: string }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/gdpr/purge", { body: { organization_id: organizationId, ...body } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceKeys.gdprPurges(organizationId) }),
    meta: { successMessage: "compliance:toast.erasureRequestSubmitted", silentError: true }, // the drawer shows it
  });
}

export function useCancelGdprPurge() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/gdpr/purge/{id}", { path: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceKeys.gdprPurges(organizationId) }),
    meta: { successMessage: "compliance:toast.erasureRequestCancelled" },
  });
}
