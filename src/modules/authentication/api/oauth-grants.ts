// OAuth grant administration. Access tokens are stateless JWTs, so what can be listed and revoked
// is the stored refresh-token grant per (client, user); revoking it ends the rotation chain. The
// pages filter and count the whole list, so it is read a page at a time up to 1,000 grants, and
// says `truncated` when more remain.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";

type GrantPage = Answer<"/v1/organizations/{organizationID}/oauth/grants">;
export type OAuthGrant = GrantPage["items"][number];

const GRANT_PAGE = 500; // the server's largest page
const GRANT_CAP = 1_000;

async function readGrants(organizationID: string, signal: AbortSignal) {
  const items: OAuthGrant[] = [];
  let cursor: string | undefined;
  do {
    const page: GrantPage = await backend.get("/v1/organizations/{organizationID}/oauth/grants", {
      path: { organizationID },
      query: { limit: GRANT_PAGE, cursor },
      signal,
    });
    items.push(...page.items);
    cursor = page.next_cursor || undefined;
  } while (cursor && items.length < GRANT_CAP);
  return { items, truncated: cursor !== undefined };
}

export function useOAuthGrants(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.oauthGrants(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: ({ signal }) => readGrants(organizationId ?? "", signal),
  });
}

export function useRevokeOAuthGrant() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/oauth/grants/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oauthGrants(organizationId) }),
    meta: { successMessage: "authentication:toast.grantRevoked" },
  });
}
