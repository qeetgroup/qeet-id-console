import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authKeys } from "@/modules/authentication/api/keys";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

/**
 * Revokes several grants, one request each: the server has no call that revokes several, or all of
 * an application's. Each revokes its person's whole refresh-token chain for that application. It
 * goes on past a failure, reports how far it is, and resolves with how many failed; the list is
 * read again once, at the end. Only the grants pages use it, so it lives with them.
 */
export function useRevokeGrants() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const mutation = useMutation({
    mutationFn: async (ids: readonly string[]) => {
      let failed = 0;
      setProgress({ done: 0, total: ids.length });
      for (const [index, id] of ids.entries()) {
        try {
          await api<void>(`/v1/tenants/${tenantId}/oauth/grants/${id}`, { method: "DELETE" });
        } catch {
          failed += 1;
        }
        setProgress({ done: index + 1, total: ids.length });
      }
      return { revoked: ids.length - failed, failed };
    },
    onSettled: () => {
      setProgress(null);
      return qc.invalidateQueries({ queryKey: authKeys.oauthGrants(tenantId) });
    },
    meta: { silent: true }, // the page says how it went
  });
  return { ...mutation, progress };
}
