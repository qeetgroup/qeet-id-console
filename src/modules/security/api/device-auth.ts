// OAuth device authorization grants (RFC 8628), each keyed by the user_code a person types on a
// second screen. Revoking one marks it denied: a device still waiting gets nothing, and the code
// can't be approved. Tokens a device already collected aren't touched.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

// `status` is pending, authorized or denied; `user_id` and `user_email` say who approved it ("" until
// someone has).
export type DeviceAuth =
  Answer<"/v1/organizations/{organizationID}/oauth/devices">["items"][number];

export function useDeviceAuthorizations() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.deviceAuthorizations(organizationId),
    enabled: !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/oauth/devices", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}

export function useRevokeDeviceAuth() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.delete("/v1/organizations/{organizationID}/oauth/devices/{id}", {
        path: { organizationID: organizationId, id },
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: securityKeys.deviceAuthorizations(organizationId) }),
    meta: { successMessage: "security:toast.deviceAuthorizationRevoked" },
  });
}
