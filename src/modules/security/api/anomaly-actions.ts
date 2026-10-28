// Resolving a sign-in anomaly: it only marks it dealt with. Nothing changes for the account or the
// network (a lock or throttle ends on its own).

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export function useResolveAnomaly() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/security/anomalies/${id}/resolve`, {
        method: "POST",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.anomalies(tenantId) }),
    meta: { successMessage: "security:toast.anomalyResolved" },
  });
}
