// Service health: the state of each part of Qeet ID the organization uses, and the incidents the
// Qeet ID team posted (open, or resolved in the last 14 days). Needs organization.read.

import { queryOptions, useQuery } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { developerKeys } from "./keys";

export type ServiceHealth = Answer<"/v1/organizations/{organizationID}/service-health">;
export type HealthComponent = ServiceHealth["components"][number];
export type HealthIncident = ServiceHealth["incidents"][number];

export const serviceHealthQueries = {
  detail: (organizationId: string | null) =>
    queryOptions({
      queryKey: developerKeys.serviceHealth(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/service-health", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      meta: { silent: true }, // the page shows the failure itself; a failing poll would toast each minute
    }),
};

export function useServiceHealth() {
  return useQuery(serviceHealthQueries.detail(useOrganizationId()));
}
