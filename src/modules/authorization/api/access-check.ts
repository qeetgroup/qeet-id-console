import { useMutation } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { DecidedBy, ReasonFields } from "./decision";

export interface ExplainPath {
  permission: string;
  granted_by: string;
  via: string; // "direct", or "group:<name>" when inherited through a group
  group_id?: string;
  role_id: string;
}

/** GET /v1/check?explain=true response; the reason fields are set on a denial. */
export interface ExplainResult extends ReasonFields {
  allowed: boolean;
  paths: ExplainPath[];
  decided_by?: DecidedBy;
}

export interface ExplainInput {
  user_id: string;
  permission: string;
}

/**
 * Checks whether a user holds a permission and returns every grant path behind the answer.
 * A mutation, not a query: it is a one-shot check the user runs, not data to cache.
 */
export function useExplainCheck() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ user_id, permission }: ExplainInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<ExplainResult>("/v1/check", {
        query: { user_id, tenant_id: tenantId, permission, explain: "true" },
      });
    },
    meta: { silent: true }, // The screen renders both allow and deny inline; no global toast
  });
}
