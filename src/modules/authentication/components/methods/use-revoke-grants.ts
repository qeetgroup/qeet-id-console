import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authKeys } from "@/modules/authentication/api/keys";
import { useOrganizationId } from "@/platform/auth/session";
import { backend } from "@/platform/api/backend";

/**
 * Revokes several grants, one request each: the server has no call that revokes several, or all of
 * an application's. Each revokes its person's whole refresh-token chain for that application. It
 * goes on past a failure, reports how far it is, and resolves with how many failed; the list is
 * read again once, at the end. Only the grants pages use it, so it lives with them.
 */
export function useRevokeGrants() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const mutation = useMutation({
    mutationFn: async (ids: readonly string[]) => {
      let failed = 0;
      setProgress({ done: 0, total: ids.length });
      for (const [index, id] of ids.entries()) {
        try {
          await backend.delete("/v1/organizations/{organizationID}/oauth/grants/{id}", {
            path: { organizationID: organizationId ?? "", id },
          });
        } catch {
          failed += 1;
        }
        setProgress({ done: index + 1, total: ids.length });
      }
      return { revoked: ids.length - failed, failed };
    },
    onSettled: () => {
      setProgress(null);
      return qc.invalidateQueries({ queryKey: authKeys.oauthGrants(organizationId) });
    },
    meta: { silent: true }, // the page says how it went
  });
  return { ...mutation, progress };
}
