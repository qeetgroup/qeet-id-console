import { api } from "@/platform/api/client";

export interface CreateOrganizationBody {
  slug: string;
  name: string;
  plan: string;
  region: string;
  logo_url?: string;
}

export interface CreateOrganizationResponse {
  tenant: { id: string; slug: string; name: string; plan: string };
  tenant_id: string;
}

/**
 * Creates a Free organisation now; the BFF moves the session into it. Paid plans aren't created
 * here: billing's signup checkout creates them once the payment goes through.
 */
export function createOrganization(body: CreateOrganizationBody) {
  return api<CreateOrganizationResponse>("/v1/tenants", { method: "POST", body });
}
