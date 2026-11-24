// Resolving a sign-in anomaly: it only marks it dealt with. Nothing changes for the account or the
// network (a lock or throttle ends on its own).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";
import { backend } from "@/platform/api/backend";

export function useResolveAnomaly() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/security/anomalies/{id}/resolve", {
        path: { organizationID: organizationId, id },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.anomalies(organizationId) }),
    meta: { successMessage: "security:toast.anomalyResolved" },
  });
}
