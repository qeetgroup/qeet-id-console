import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { organizationSelectionPageSchema } from "@/platform/auth/organization-selection";

/**
 * Whether this person belongs to any organisation yet: one membership is enough to know. Asked
 * here rather than through authentication's list, whose barrel would load its account screens
 * into this page.
 */
export function useHasOrganization(userId: string | null) {
  return useQuery({
    queryKey: ["onboarding", "has-organization", userId],
    queryFn: async ({ signal }) => {
      const page = await api("/v1/me/organizations", {
        query: { limit: 1, cursor: "" },
        signal,
        schema: organizationSelectionPageSchema,
      });
      return page.items.length > 0;
    },
    enabled: !!userId,
    retry: false,
    meta: { silent: true }, // unknown, the page treats it as a first organisation
  });
}
