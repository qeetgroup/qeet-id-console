import { queryOptions, useQuery } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";
import type { Branding } from "../branding-model";
import { brandingKeys } from "./keys";
import { backend } from "@/platform/api/backend";

export const brandingQueries = {
  detail: (organizationId: string | null) =>
    queryOptions({
      queryKey: brandingKeys.organization(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/branding", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
    }),
};

export function useBranding(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    ...brandingQueries.detail(organizationId),
    enabled: !!organizationId && enabled,
  });
}

export function saveBranding(organizationId: string, branding: Branding) {
  return backend.put("/v1/organizations/{organizationID}/branding", {
    path: { organizationID: organizationId },
    body: branding,
  });
}
