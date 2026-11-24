// The organisation's set-up and counts in one read (organization.read). Each area is in the answer
// only when the caller may read that area's own list, so a panel or set-up item whose area is
// missing drops out, as it does for a list the person can't read.
import { useQuery } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { dashboardKeys } from "./keys";

export type OrganizationOverview = Answer<"/v1/organizations/{organizationID}/overview">;

export function useOrganizationOverview(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: dashboardKeys.overview(organizationId),
    queryFn: ({ signal }) =>
      backend.get("/v1/organizations/{organizationID}/overview", {
        path: { organizationID: organizationId ?? "" },
        signal,
      }),
    enabled: enabled && !!organizationId,
    staleTime: 30_000,
    meta: { silent: true },
  });
}
