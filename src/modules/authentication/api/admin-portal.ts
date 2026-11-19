// Self-serve Admin Portal links: a time-limited token, scoped to SAML or SCIM, that lets an
// external IT admin with no Qeet ID account configure this tenant's SSO. The raw token and URL are
// returned once, on generate.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { assured, assuredItems, strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer, Body, Schemas } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";

type LinkRecord = Schemas<"federation">["AdminPortalLink"];
export type AdminPortalCapability = NonNullable<LinkRecord["capabilities"]>[number];

// The server always sends these (internal/federation/adminportal/adminportal.go, Link); the
// document marks them optional (QTID-1063).
const LINK_FIELDS = ["id", "organization_id", "capabilities", "expires_at", "created_at"] as const;
const linkPage = assuredItems<Answer<"/v1/organizations/{organizationID}/admin-portal/links">>()(
  ...LINK_FIELDS,
);
export type AdminPortalLink = z.infer<typeof linkPage>["items"][number];

export type GenerateAdminPortalLinkInput = Body<
  "/v1/organizations/{organizationID}/admin-portal/links",
  "post"
>;

// The token and its URL come back this once.
const generatedLink = strictly<
  Answer<"/v1/organizations/{organizationID}/admin-portal/links", "post">
>()(
  z.object({
    link: assured<LinkRecord>()(...LINK_FIELDS),
    token: z.string().min(1),
    url: z.string().min(1),
  }),
);
export type GenerateAdminPortalLinkResponse = z.infer<typeof generatedLink>;

export function useAdminPortalLinks() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.adminPortalLinks(organizationId),
    enabled: !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/admin-portal/links", {
        path: { organizationID: organizationId ?? "" },
        schema: linkPage,
      }),
  });
}

export function useGenerateAdminPortalLink() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the link is a bearer credential, shown once
    mutationFn: (body: GenerateAdminPortalLinkInput) =>
      backend.post("/v1/organizations/{organizationID}/admin-portal/links", {
        path: { organizationID: organizationId ?? "" },
        body,
        schema: generatedLink,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.adminPortalLinks(organizationId) }),
    meta: { successMessage: "connections:toast.linkMade", silentError: true }, // the card shows it
  });
}

export function useRevokeAdminPortalLink() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/admin-portal/links/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.adminPortalLinks(organizationId) }),
    meta: { successMessage: "connections:toast.linkRevoked" },
  });
}

export function isAdminPortalLinkActive(l: AdminPortalLink): boolean {
  return !l.revoked_at && new Date(l.expires_at).getTime() > Date.now();
}
