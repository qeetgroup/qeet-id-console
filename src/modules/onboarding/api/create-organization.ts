import { backend } from "@/platform/api/backend";
import type { Body } from "@/platform/api/contract";

export type CreateOrganizationBody = Body<"/v1/organizations", "post">;

/**
 * Creates a Free organisation now; the BFF moves the session into it. Paid plans aren't created
 * here: billing's signup checkout creates them once the payment goes through.
 */
export function createOrganization(body: CreateOrganizationBody) {
  return backend.post("/v1/organizations", { body });
}
