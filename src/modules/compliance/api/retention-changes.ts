// What the Retention page reads and changes beyond the policy: who the saved window makes due now,
// saving the policy, and removing the due people at once. Page-only, so the shell doesn't carry it.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userKeys } from "@/modules/users";
import { useOrganizationId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";
import type { RetentionPolicy } from "./retention";
import { backend } from "@/platform/api/backend";

/**
 * How many deleted people the saved window makes due now. The server's preview is a POST that only
 * counts (policy.read), so it's read like any query.
 */
export function useRetentionDue(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: complianceKeys.retentionDue(organizationId),
    enabled: !!organizationId && enabled,
    queryFn: () =>
      backend.post("/v1/organizations/{organizationID}/retention/preview", {
        path: { organizationID: organizationId ?? "" },
      }),
    meta: { silent: true },
  });
}

export function useUpdateRetentionPolicy() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RetentionPolicy) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.put("/v1/organizations/{organizationID}/retention", {
        path: { organizationID: organizationId },
        body,
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(complianceKeys.retention(organizationId), data);
      void qc.invalidateQueries({ queryKey: complianceKeys.retentionDue(organizationId) });
    },
    meta: { successMessage: "compliance:toast.retentionPolicySaved" },
  });
}

/** Removes, now, every deleted person past the saved window, whether automatic removal is on or not. */
export function useRunRetention() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/retention/run", {
        path: { organizationID: organizationId },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.deleted(organizationId) });
      void qc.invalidateQueries({ queryKey: complianceKeys.retentionDue(organizationId) });
    },
    meta: { successMessage: "compliance:toast.retentionPurgeComplete" },
  });
}
