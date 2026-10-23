import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TranslationKey } from "@/i18n";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { ReasonFields } from "./decision";
import { authzKeys } from "./keys";

export const NAMESPACES = ["subject", "resource", "context"] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const OPERATORS = [
  "eq",
  "ne",
  "in",
  "nin",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "exists",
  "prefix",
  "suffix",
  "regex",
] as const;
export type Operator = (typeof OPERATORS)[number];

export const NULLARY_OPERATORS: readonly Operator[] = ["exists"]; // take no right-hand value
export const LIST_OPERATORS: readonly Operator[] = ["in", "nin"]; // comma-separated in the UI
const STRING_OPERATORS: readonly Operator[] = ["prefix", "suffix", "regex"]; // value stays a string
// Operators whose value may name another attribute; never regex, so a pattern can't come from
// request data.
export const REFERENCE_OPERATORS: readonly Operator[] = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "nin",
  "contains",
];
const ATTRIBUTE_PATH = new RegExp(`^(${NAMESPACES.join("|")})(\\.[^.\\s]+)+$`);

// Catalogue keys; the policy DSL keeps its own English keywords (see policy-codegen).
export const OPERATOR_LABELS: Record<Operator, TranslationKey> = {
  eq: "authorization:operators.eq",
  ne: "authorization:operators.ne",
  in: "authorization:operators.in",
  nin: "authorization:operators.nin",
  contains: "authorization:operators.contains",
  gt: "authorization:operators.gt",
  gte: "authorization:operators.gte",
  lt: "authorization:operators.lt",
  lte: "authorization:operators.lte",
  exists: "authorization:operators.exists",
  prefix: "authorization:operators.prefix",
  suffix: "authorization:operators.suffix",
  regex: "authorization:operators.regex",
};

export type Effect = "allow" | "deny";

/** A leaf value naming another attribute, compared with the leaf's own. */
export type AttributeRef = { attr: string };

/**
 * A stored policy condition: `all` (AND), `any` (OR), `not`, or a comparison leaf whose `attr`
 * is a dot path under `subject.`, `resource.` or `context.`, and whose `value` is a literal or
 * an AttributeRef. A comparison with an absent attribute matches a deny and never an allow.
 */
export type ConditionJson =
  | { all: ConditionJson[] }
  | { any: ConditionJson[] }
  | { not: ConditionJson }
  | { attr: string; op: Operator; value?: unknown };

function isAttributeRef(value: unknown): value is AttributeRef {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as { attr?: unknown }).attr === "string"
  );
}

/** A stored ABAC policy. Deny wins, and policies are evaluated by descending priority. */
export interface AbacPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  effect: Effect;
  resource_type: string;
  action: string;
  condition: ConditionJson | null;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AbacPolicyInput {
  name: string;
  description: string;
  effect: Effect;
  resource_type: string;
  action: string;
  condition: ConditionJson | null;
  priority: number;
  enabled: boolean;
}

/** POST /abac/evaluate?explain=true response; `reason` is English, `reason_code` its code. */
export interface AbacDecision extends ReasonFields {
  allow: boolean;
  effect: Effect | "";
  matched_policy_id?: string | null;
  trace?: string[];
}

export interface AbacEvaluationInput {
  subject: Record<string, unknown>;
  resource: { type: string; id: string; attrs?: Record<string, unknown> };
  action: string;
  context?: Record<string, unknown>;
}

let _seq = 0;
export function nid(prefix = "n"): string {
  _seq += 1;
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    // fall back to a time-based id
  }
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

/** The editable form of a condition; every node carries a stable id for React keys. */
export type CondNode =
  | { id: string; kind: "group"; combinator: "all" | "any"; children: CondNode[] }
  | { id: string; kind: "not"; child: CondNode }
  | {
      id: string;
      kind: "leaf";
      attr: string;
      op: Operator;
      value: string;
      ref?: boolean; // `value` names another attribute rather than a literal
    };

export function emptyLeaf(): CondNode {
  return { id: nid("leaf"), kind: "leaf", attr: "subject.", op: "eq", value: "" };
}

export function emptyGroup(combinator: "all" | "any" = "all"): CondNode {
  return { id: nid("grp"), kind: "group", combinator, children: [emptyLeaf()] };
}

/** Returns the stored form of an editable condition; list values are split on commas. */
export function toConditionJson(node: CondNode): ConditionJson {
  switch (node.kind) {
    case "group": {
      const children = node.children.map(toConditionJson);
      return node.combinator === "all" ? { all: children } : { any: children };
    }
    case "not":
      return { not: toConditionJson(node.child) };
    case "leaf": {
      if (NULLARY_OPERATORS.includes(node.op)) return { attr: node.attr, op: node.op };
      if (node.ref) return { attr: node.attr, op: node.op, value: { attr: node.value.trim() } };
      if (STRING_OPERATORS.includes(node.op)) {
        return { attr: node.attr, op: node.op, value: node.value.trim() };
      }
      if (LIST_OPERATORS.includes(node.op)) {
        return {
          attr: node.attr,
          op: node.op,
          value: node.value
            .split(",")
            .map((v) => coerce(v.trim()))
            .filter((v) => v !== ""),
        };
      }
      return { attr: node.attr, op: node.op, value: coerce(node.value.trim()) };
    }
  }
}

/** Returns `raw` as a boolean or number when it is exactly one, otherwise as the string. */
function coerce(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  // Only a canonical numeral: "02134" or "1.50" would lose characters as a number.
  const n = Number(raw);
  if (Number.isFinite(n) && String(n) === raw) return n;
  return raw;
}

/** Returns the editable form of a stored condition; null becomes an empty ALL group. */
export function fromConditionJson(json: ConditionJson | null | undefined): CondNode {
  if (!json) return emptyGroup();
  if ("all" in json) {
    return {
      id: nid("grp"),
      kind: "group",
      combinator: "all",
      children: json.all.length ? json.all.map(fromConditionJson) : [emptyLeaf()],
    };
  }
  if ("any" in json) {
    return {
      id: nid("grp"),
      kind: "group",
      combinator: "any",
      children: json.any.length ? json.any.map(fromConditionJson) : [emptyLeaf()],
    };
  }
  if ("not" in json) {
    return { id: nid("not"), kind: "not", child: fromConditionJson(json.not) };
  }
  if (isAttributeRef(json.value)) {
    return {
      id: nid("leaf"),
      kind: "leaf",
      attr: json.attr,
      op: json.op,
      value: json.value.attr,
      ref: true,
    };
  }
  const value = Array.isArray(json.value)
    ? json.value.join(", ")
    : json.value == null
      ? ""
      : String(json.value);
  return { id: nid("leaf"), kind: "leaf", attr: json.attr, op: json.op, value };
}

/**
 * Why the backend would refuse a condition, as a code translated at `authorization:conditionProblem.<code>`;
 * `op` is the operator at fault.
 */
export interface ConditionProblem {
  code: "notReferenceable" | "badReference" | "selfReference" | "needsValue";
  op: Operator;
}

/**
 * Returns why the backend would refuse a condition, or null when it can be saved. Mirrors the
 * engine's validation, so the form says so before the request does.
 */
export function conditionProblem(node: CondNode): ConditionProblem | null {
  if (node.kind === "group") {
    for (const child of node.children) {
      const problem = conditionProblem(child);
      if (problem) return problem;
    }
    return null;
  }
  if (node.kind === "not") return conditionProblem(node.child);
  const { op } = node;
  if (node.ref) {
    if (!REFERENCE_OPERATORS.includes(op)) return { code: "notReferenceable", op };
    const other = node.value.trim();
    if (!ATTRIBUTE_PATH.test(other)) return { code: "badReference", op };
    if (other === node.attr) return { code: "selfReference", op };
    return null;
  }
  // An empty affix, substring or pattern would match every string.
  const needsValue = STRING_OPERATORS.includes(op) || op === "contains";
  if (needsValue && node.value.trim() === "") return { code: "needsValue", op };
  return null;
}

/** Returns the number of comparison leaves in a condition. */
export function countLeaves(node: CondNode): number {
  if (node.kind === "leaf") return 1;
  if (node.kind === "not") return countLeaves(node.child);
  return node.children.reduce((n, c) => n + countLeaves(c), 0);
}

export function useAbacPolicies() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authzKeys.abacPolicies(tenantId),
    enabled: !!tenantId,
    queryFn: () => api<{ items: AbacPolicy[] }>(`/v1/tenants/${tenantId}/abac/policies`),
  });
}

export function useAbacPolicy(id: string | null) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authzKeys.abacPolicy(tenantId, id),
    enabled: !!tenantId && !!id,
    queryFn: () => api<AbacPolicy>(`/v1/tenants/${tenantId}/abac/policies/${id}`),
  });
}

export function useCreateAbacPolicy() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AbacPolicyInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<AbacPolicy>(`/v1/tenants/${tenantId}/abac/policies`, { method: "POST", body });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authzKeys.abacPolicies(tenantId) }),
    meta: { successMessage: "authorization:toast.policyCreated", silentError: true }, // its forms show the error
  });
}

export function useUpdateAbacPolicy(id: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AbacPolicyInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<AbacPolicy>(`/v1/tenants/${tenantId}/abac/policies/${id}`, {
        method: "PATCH",
        body,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authzKeys.abacPolicies(tenantId) }),
    meta: { successMessage: "authorization:toast.policyUpdated", silentError: true },
  });
}

export function useDeleteAbacPolicy() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/abac/policies/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authzKeys.abacPolicies(tenantId) }),
    meta: { successMessage: "authorization:toast.policyDeleted" },
  });
}

/** Evaluates one request against the ABAC policies and returns the decision with its trace. */
export function useAbacEvaluate() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (input: AbacEvaluationInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<AbacDecision>(`/v1/tenants/${tenantId}/abac/evaluate`, {
        method: "POST",
        body: input,
        query: { explain: "true" },
      });
    },
    meta: { silent: true },
  });
}
