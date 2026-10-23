// The decision vocabulary the engines share (QTID-951): a stable reason code with what it names,
// and the `decided_by` summary every check response carries. All optional: an older server sends
// only English sentences, which the console never shows as written.

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

/** The engine that decided a check, and why, as the caller may see it. */
export interface DecidedBy {
  model: string; // tenant, abac, rbac, rebac or none
  rule?: string; // English; never shown
  reason_code?: string;
  reason_params?: ReasonParams;
  policy_id?: string;
}
