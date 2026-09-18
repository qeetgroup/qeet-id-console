import { z } from "zod";

import { isSignInRequest } from "./session-response";

export const eligibleOrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  plan: z.string(),
  region: z.string(),
  logo_url: z.string(),
  domain: z.string(),
  roles: z.array(z.string()),
  last_used_at: z.string().datetime({ offset: true }).nullable(),
});

export const organizationSelectionPageSchema = z.object({
  items: z.array(eligibleOrganizationSchema),
  next_cursor: z.string(),
});

export type EligibleOrganization = z.infer<typeof eligibleOrganizationSchema>;
export type OrganizationSelectionPage = z.infer<typeof organizationSelectionPageSchema>;

export function requiresOrganizationSelection(value: unknown): boolean {
  const result = organizationSelectionPageSchema.safeParse(value);
  return !result.success || result.data.next_cursor !== "" || result.data.items.length > 1;
}

export async function signInRequiresOrganizationSelection(
  path: string,
  method: string,
  load: () => Promise<unknown>,
): Promise<boolean> {
  if (!isSignInRequest(path, method)) return false;
  try {
    return requiresOrganizationSelection(await load());
  } catch {
    return true;
  }
}

export function organizationSelectionBlocksPath(
  required: boolean | undefined,
  pathname: string,
): boolean {
  return required === true && pathname !== "/account" && !pathname.startsWith("/account/");
}
