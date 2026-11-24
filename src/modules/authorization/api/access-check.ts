import { useMutation } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

// GET /v1/check?explain=true: the grant paths behind an allow, the reason fields on a denial.
export type ExplainResult = Answer<"/v1/check">;
export type ExplainPath = NonNullable<ExplainResult["paths"]>[number];

export interface ExplainInput {
  user_id: string;
  permission: string;
}

/**
 * Checks whether a user holds a permission and returns every grant path behind the answer.
 * A mutation, not a query: it is a one-shot check the user runs, not data to cache.
 */
export function useExplainCheck() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: ({ user_id, permission }: ExplainInput) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.get("/v1/check", {
        query: { user_id, organization_id: organizationId, permission, explain: "true" },
      });
    },
    meta: { silent: true }, // The screen renders both allow and deny inline; no global toast
  });
}
