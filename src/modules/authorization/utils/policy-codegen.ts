// Turns the Policy Builder's PolicyDoc into its JSON, YAML, DSL and evaluation-tree previews,
// and decides whether it can be saved as an ABAC policy.

import i18n from "@/i18n";
import {
  type AbacPolicyInput,
  type CondNode,
  type ConditionProblem,
  conditionProblem,
  type Effect,
  emptyGroup,
  OPERATOR_LABELS,
  type Operator,
  toConditionJson,
} from "../api/abac";

/**
 * The Policy Builder's authoring model. Its RBAC (`requireRole`) and ReBAC (`relation`) blocks
 * preview and simulate, but no ABAC condition can encode them, so they block saving.
 */
export interface PolicyDoc {
  name: string;
  description: string;
  effect: Effect;
  resourceType: string;
  action: string;
  requireRole: string | null;
  condition: CondNode | null;
  relation: { object: string; relation: string } | null;
  priority: number;
  enabled: boolean;
}

export function emptyPolicyDoc(): PolicyDoc {
  return {
    name: "",
    description: "",
    effect: "allow",
    resourceType: "",
    action: "",
    requireRole: null,
    condition: emptyGroup("all"),
    relation: null,
    priority: 10,
    enabled: true,
  };
}

/** Why a doc can't be saved as an ABAC policy, translated at `authorization:conditionProblem.<code>`. */
export type PolicyProblem = ConditionProblem | { code: "mixedEngines" };

/** Returns why a doc can't be saved as an ABAC policy, or null when it can. */
export function abacSaveBlocker(doc: PolicyDoc): PolicyProblem | null {
  // An RBAC or ReBAC block has no ABAC equivalent, so the backend has nothing to store it in.
  if (doc.requireRole || doc.relation) return { code: "mixedEngines" };
  return doc.condition ? conditionProblem(doc.condition) : null;
}

/** Returns whether a doc can be saved as an ABAC policy (see abacSaveBlocker). */
export function isReducibleToAbac(doc: PolicyDoc): boolean {
  return abacSaveBlocker(doc) === null;
}

export function toAbacInput(doc: PolicyDoc): AbacPolicyInput {
  return {
    name: doc.name,
    description: doc.description,
    effect: doc.effect,
    resource_type: doc.resourceType || "*",
    action: doc.action || "*",
    condition: doc.condition ? toConditionJson(doc.condition) : null,
    priority: doc.priority,
    enabled: doc.enabled,
  };
}

export function toJsonObject(doc: PolicyDoc): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    name: doc.name || "(unnamed)",
    effect: doc.effect,
    resource_type: doc.resourceType || "*",
    action: doc.action || "*",
    priority: doc.priority,
    enabled: doc.enabled,
  };
  if (doc.requireRole) obj.rbac = { require_role: doc.requireRole };
  if (doc.relation) obj.rebac = { object: doc.relation.object, relation: doc.relation.relation };
  obj.condition = doc.condition ? toConditionJson(doc.condition) : null;
  return obj;
}

export function toJson(doc: PolicyDoc): string {
  return JSON.stringify(toJsonObject(doc), null, 2);
}

function needsQuote(s: string): boolean {
  return (
    s === "" ||
    /[:#{}[\],&*!|>'"%@`]/.test(s) ||
    /[\n\r\t]/.test(s) ||
    /^[\s-]/.test(s) ||
    /\s$/.test(s) ||
    ["true", "false", "null", "yes", "no", "~"].includes(s.toLowerCase()) ||
    !Number.isNaN(Number(s))
  );
}

function yamlScalar(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  return needsQuote(s) ? JSON.stringify(s) : s;
}

/** Returns YAML for a plain JSON value; a minimal serializer, to avoid a YAML dependency. */
export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const body = toYaml(item, indent + 1).replace(/^ {2}/, "");
          return `${pad}- ${body.trimStart()}`;
        }
        return `${pad}- ${yamlScalar(item)}`;
      })
      .join("\n");
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${pad}{}`;
    return entries
      .map(([k, v]) => {
        if (v !== null && typeof v === "object") {
          const isArr = Array.isArray(v);
          const empty = isArr ? (v as unknown[]).length === 0 : Object.keys(v).length === 0;
          if (empty) return `${pad}${k}: ${isArr ? "[]" : "{}"}`;
          return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${yamlScalar(v)}`;
      })
      .join("\n");
  }
  return `${pad}${yamlScalar(value)}`;
}

export function toYamlDoc(doc: PolicyDoc): string {
  return toYaml(toJsonObject(doc));
}

// The DSL's operator keywords: syntax, so they stay English whatever the reader's language.
const DSL_OPERATORS: Record<Operator, string> = {
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

function dslValue(node: Extract<CondNode, { kind: "leaf" }>): string {
  if (node.op === "exists") return "";
  // An attribute reference stays bare, so it reads apart from a quoted literal.
  return node.ref ? ` ${node.value.trim()}` : ` ${JSON.stringify(node.value)}`;
}

function dslCondition(node: CondNode, indent: number): string {
  const pad = "  ".repeat(indent);
  if (node.kind === "leaf") {
    return `${pad}${node.attr} ${DSL_OPERATORS[node.op]}${dslValue(node)}`;
  }
  if (node.kind === "not") {
    return `${pad}NOT (\n${dslCondition(node.child, indent + 1)}\n${pad})`;
  }
  const joiner = node.combinator === "all" ? "AND" : "OR";
  return node.children
    .map((c, i) => {
      // Parenthesise a multi-child subgroup: "a AND b OR c" would hide which binds first.
      const body =
        c.kind === "group" && c.children.length > 1
          ? `${pad}(\n${dslCondition(c, indent + 1)}\n${pad})`
          : dslCondition(c, indent);
      return i === 0 ? body : `${pad}${joiner}\n${body}`;
    })
    .join("\n");
}

/** Returns the doc in the console's readable, Cedar-like policy DSL. */
export function toDsl(doc: PolicyDoc): string {
  const lines: string[] = [];
  lines.push(`POLICY ${JSON.stringify(doc.name || "unnamed")}`);
  lines.push(`EFFECT ${doc.effect.toUpperCase()}`);
  lines.push(`ON ${doc.resourceType || "*"} : ${doc.action || "*"}`);
  lines.push(`PRIORITY ${doc.priority}`);
  const clauses: string[] = [];
  if (doc.requireRole) clauses.push(`  subject HAS ROLE ${JSON.stringify(doc.requireRole)}`);
  if (doc.relation)
    clauses.push(`  subject IS ${doc.relation.relation} OF ${JSON.stringify(doc.relation.object)}`);
  if (doc.condition) {
    const condition = doc.condition;
    // Beside a role or relation clause, a multi-child OR group needs parentheses to bind first.
    const grouped =
      clauses.length > 0 &&
      condition.kind === "group" &&
      condition.combinator === "any" &&
      condition.children.length > 1;
    clauses.push(grouped ? `  (\n${dslCondition(condition, 2)}\n  )` : dslCondition(condition, 1));
  }
  if (clauses.length) {
    lines.push("WHEN");
    lines.push(clauses.join("\n  AND\n"));
  }
  lines.push(doc.enabled ? "STATUS enabled" : "STATUS disabled");
  return lines.join("\n");
}

/** One node of the evaluation tree; `label` and `detail` are in the reader's language. */
export interface EvalTreeNode {
  id: string;
  kind: "decision" | "and" | "or" | "not" | "leaf" | "block";
  label: string;
  detail?: string;
  children?: EvalTreeNode[];
}

let _t = 0;
function tid() {
  _t += 1;
  return `t${_t}`;
}

function condToTree(node: CondNode): EvalTreeNode {
  if (node.kind === "leaf") {
    const operator = i18n.t(OPERATOR_LABELS[node.op]);
    return {
      id: tid(),
      kind: "leaf",
      label: node.attr,
      detail:
        node.op === "exists"
          ? operator
          : i18n.t("authorization:evalTree.comparison", { operator, value: node.value || "…" }),
    };
  }
  if (node.kind === "not") {
    return {
      id: tid(),
      kind: "not",
      label: i18n.t("authorization:evalTree.not"),
      children: [condToTree(node.child)],
    };
  }
  return {
    id: tid(),
    kind: node.combinator === "all" ? "and" : "or",
    label: i18n.t(
      node.combinator === "all" ? "authorization:evalTree.all" : "authorization:evalTree.any",
    ),
    children: node.children.map(condToTree),
  };
}

/** Returns the doc's evaluation tree, translated when called: build it at render. */
export function toEvalTree(doc: PolicyDoc): EvalTreeNode {
  _t = 0;
  const children: EvalTreeNode[] = [];
  if (doc.requireRole)
    children.push({
      id: tid(),
      kind: "block",
      label: "RBAC",
      detail: i18n.t("authorization:evalTree.requireRole", { role: doc.requireRole }),
    });
  if (doc.relation)
    children.push({
      id: tid(),
      kind: "block",
      label: "ReBAC",
      detail: i18n.t("authorization:evalTree.relationOf", {
        relation: doc.relation.relation,
        object: doc.relation.object,
      }),
    });
  if (doc.condition) children.push(condToTree(doc.condition));
  return {
    id: tid(),
    kind: "decision",
    label: i18n.t("authorization:evalTree.decision", {
      effect: i18n.t(`authorization:decisionBadge.${doc.effect}`),
      target: `${doc.resourceType || "*"}:${doc.action || "*"}`,
    }),
    detail: i18n.t(
      children.length
        ? "authorization:evalTree.whenAllBlocksMatch"
        : "authorization:evalTree.unconditional",
    ),
    children,
  };
}
