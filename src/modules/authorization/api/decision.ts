// The decision vocabulary the engines share: a stable reason code with what it names,
// and the `decided_by` summary every check response carries. All optional: an older server sends
// only English sentences, which the console never shows as written.

import type { Answer } from "@/platform/api/contract";

/** What a reason code names; each field only for the codes that use it. */
export interface ReasonParams {
  policy_id?: string;
  policy_name?: string; // omitted, with priority, when the caller may not read policies
  priority?: number;
  permission?: string; // authz.role_grant
  relation?: string; // authz.relation_grant, with object
  object?: string;
}

/** Why a check came out as it did: a code, what it names, and the older English sentence. */
export interface ReasonFields {
  reason?: string;
  reason_code?: string;
  reason_params?: ReasonParams;
}

/** The engine that decided a check (organization, abac, rbac, rebac or none), and why. */
export type DecidedBy = NonNullable<Answer<"/v1/check">["decided_by"]>;
