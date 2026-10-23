import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

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

export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: "equals",
  ne: "not equals",
  in: "in",
  nin: "not in",
  contains: "contains",
  gt: "greater than",
  gte: "greater or equal",
  lt: "less than",
  lte: "less or equal",
  exists: "exists",
  prefix: "starts with",
  suffix: "ends with",
  regex: "matches regex",
};

export type Effect = "allow" | "deny";

/**
 * A stored policy condition: `all` (AND), `any` (OR), `not`, or a comparison leaf whose `attr`
 * is a dot path under `subject.`, `resource.` or `context.`.
 */
export type ConditionJson =
  | { all: ConditionJson[] }
  | { any: ConditionJson[] }
  | { not: ConditionJson }
  | { attr: string; op: Operator; value?: unknown };

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

/** POST /abac/evaluate?explain=true response. */
export interface AbacDecision {
  allow: boolean;
  effect: Effect | "";
  matched_policy_id?: string | null;
  reason?: string;
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
  | { id: string; kind: "leaf"; attr: string; op: Operator; value: string };

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
  const value = Array.isArray(json.value)
    ? json.value.join(", ")
    : json.value == null
      ? ""
      : String(json.value);
  return { id: nid("leaf"), kind: "leaf", attr: json.attr, op: json.op, value };
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
    queryKey: ["abac-policies", tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: AbacPolicy[] }>(`/v1/tenants/${tenantId}/abac/policies`),
  });
}

export function useAbacPolicy(id: string | null) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["abac-policy", tenantId, id],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["abac-policies"] }),
    meta: { successMessage: "Policy created" },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["abac-policies"] });
      qc.invalidateQueries({ queryKey: ["abac-policy"] });
    },
    meta: { successMessage: "Policy updated" },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["abac-policies"] }),
    meta: { successMessage: "Policy deleted" },
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
