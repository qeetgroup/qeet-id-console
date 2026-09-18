import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import {
  organizationSelectionPageSchema,
  type EligibleOrganization,
  type OrganizationSelectionPage,
} from "@/platform/auth/organization-selection";

export async function loadEligibleOrganizations(
  signal?: AbortSignal,
): Promise<EligibleOrganization[]> {
  const organizations = new Map<string, EligibleOrganization>();
  const visited = new Set<string>();
  let cursor = "";
  do {
    if (visited.has(cursor)) throw new Error("Organization pagination did not advance");
    visited.add(cursor);
    const page = await api<OrganizationSelectionPage>("/v1/me/organizations", {
      query: { limit: 200, cursor },
      signal,
      schema: organizationSelectionPageSchema,
    });
    for (const organization of page.items) organizations.set(organization.id, organization);
    cursor = page.next_cursor;
  } while (cursor);
  return [...organizations.values()];
}

export function useEligibleOrganizations(userId: string | null) {
  return useQuery({
    queryKey: ["organization-selection", userId],
    queryFn: ({ signal }) => loadEligibleOrganizations(signal),
    enabled: !!userId,
    retry: false,
    staleTime: 0,
    meta: { silent: true },
  });
}
