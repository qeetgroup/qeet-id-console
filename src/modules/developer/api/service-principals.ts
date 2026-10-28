// Machine identities (service principals). The client secret is returned once, on create, and
// stored hashed, so show it immediately: it can't be read again.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { developerKeys } from "./keys";

const servicePrincipalSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()).nullable(),
  disabled_at: z.string().nullish(),
  created_at: z.string(),
});
export type ServicePrincipal = z.infer<typeof servicePrincipalSchema>;

const servicePrincipalListSchema = z.object({ items: z.array(servicePrincipalSchema) });

export const createdServicePrincipalSchema = z.object({
  service_principal: servicePrincipalSchema,
  client_id: z.string(),
  client_secret: z.string().min(1), // Shown this once
  warning: z.string().optional(),
});
export type CreatedServicePrincipal = z.infer<typeof createdServicePrincipalSchema>;

export type CreateServicePrincipalInput = {
  tenant_id: string;
  name: string;
  description?: string;
  scopes?: string[];
};

export const servicePrincipalQueries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: developerKeys.servicePrincipals(tenantId),
      queryFn: () =>
        api(`/v1/tenants/${tenantId}/service-principals`, { schema: servicePrincipalListSchema }),
      enabled: !!tenantId,
    }),
};

export function useServicePrincipals() {
  return useQuery(servicePrincipalQueries.list(useTenantId()));
}
