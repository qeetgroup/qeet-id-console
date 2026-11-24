// Machine identities (service principals). The client secret is returned once, on create, and
// stored hashed, so show it immediately: it can't be read again.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useOrganizationId } from "@/platform/auth/session";

import { developerKeys } from "./keys";
import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";

const servicePrincipalSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()).nullable(),
  disabled_at: z.string().nullish(),
  created_at: z.string(),
});
export type ServicePrincipal = z.infer<typeof servicePrincipalSchema>;

const servicePrincipalListSchema = strictly<
  Answer<"/v1/organizations/{organizationID}/service-principals">
>()(z.object({ items: z.array(servicePrincipalSchema) }));

export const createdServicePrincipalSchema = strictly<Answer<"/v1/service-principals", "post">>()(
  z.object({
    service_principal: servicePrincipalSchema,
    client_id: z.string(),
    client_secret: z.string().min(1), // Shown this once
    warning: z.string().optional(),
  }),
);
export type CreatedServicePrincipal = z.infer<typeof createdServicePrincipalSchema>;

// The document requires organization_id; the server takes the caller's in any case.
export type CreateServicePrincipalInput = Body<"/v1/service-principals", "post">;

export const servicePrincipalQueries = {
  list: (organizationId: string | null) =>
    queryOptions({
      queryKey: developerKeys.servicePrincipals(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/service-principals", {
          path: { organizationID: organizationId ?? "" },
          schema: servicePrincipalListSchema,
        }),
      enabled: !!organizationId,
    }),
};

export function useServicePrincipals() {
  return useQuery(servicePrincipalQueries.list(useOrganizationId()));
}
