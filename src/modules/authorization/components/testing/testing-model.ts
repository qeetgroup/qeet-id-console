// The Testing page's questions, and how a decision any tool made reads back: who it was about,
// what was asked, which engine decided, and the trace and paths behind it.

import type { DecidedBy } from "@/modules/authorization/api/decision";
import type {
  DecisionRecord,
  Engine,
  RbacExplainPath,
  RebacPathStep,
} from "@/modules/authorization/api/simulate";

/** The four questions: each one endpoint (see testing-page.tsx). */
export const MODES = ["permission", "relationship", "attributes", "authzen"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_OF: Record<Engine, Mode> = {
  rbac: "permission",
  rebac: "relationship",
  abac: "attributes",
  authzen: "authzen",
};

/** What the request form holds; the person is shared by the modes that ask about one. */
export interface TestForm {
  userId: string;
  permission: string;
  relation: string;
  object: string;
  action: string;
  resourceType: string;
  resourceId: string;
  request: string;
  subjects: string[];
}

export const DEFAULT_REQUEST = JSON.stringify(
  {
    subject: { department: "Engineering" },
    resource: { type: "document", id: "readme" },
    action: "read",
    context: { mfa: true },
  },
  null,
  2,
);

export function emptyForm(userId = ""): TestForm {
  return {
    userId,
    permission: "",
    relation: "viewer",
    object: "",
    action: "read",
    resourceType: "document",
    resourceId: "",
    request: DEFAULT_REQUEST,
    subjects: [],
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** The form a past decision was asked with, to look at it again or run it again. */
export function formOf(record: DecisionRecord, base: TestForm): TestForm {
  const input = record.input;
  switch (record.engine) {
    case "rbac":
      return { ...base, userId: str(input.user_id), permission: str(input.permission) };
    case "rebac":
      return {
        ...base,
        userId: str(input.user_id),
        relation: str(input.relation),
        object: str(input.object),
      };
    case "authzen": {
      const resource = obj(input.resource);
      return {
        ...base,
        userId: str(obj(input.subject).id),
        action: str(input.action),
        resourceType: str(resource.type),
        resourceId: str(resource.id),
      };
    }
    case "abac":
      return { ...base, request: JSON.stringify(input, null, 2) };
  }
}

/** The person a decision was about, when it was about one. */
export function subjectIdOf(record: DecisionRecord): string | null {
  const input = record.input;
  if (record.engine === "rbac" || record.engine === "rebac") return str(input.user_id) || null;
  if (record.engine === "authzen") return str(obj(input.subject).id) || null;
  return str(obj(input.subject).id) || null;
}

/** What was asked, as its code: `role.write`, `editor · document:readme`, `read · document`. */
export function askedOf(record: DecisionRecord): string {
  const input = record.input;
  switch (record.engine) {
    case "rbac":
      return str(input.permission);
    case "rebac":
      return `${str(input.relation)} · ${str(input.object)}`;
    case "authzen": {
      const r = obj(input.resource);
      return str(r.type) === "permission"
        ? str(input.action)
        : `${str(input.action)} · ${str(r.type)}:${str(r.id)}`;
    }
    case "abac": {
      const r = obj(input.resource);
      return `${str(input.action)} · ${str(r.type)}${str(r.id) ? `:${str(r.id)}` : ""}`;
    }
  }
}

/** A subject's attributes in a few words, for an attribute check about no one by name. */
export function attributesOf(record: DecisionRecord): string {
  const entries = Object.entries(obj(record.input.subject));
  return entries
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

/** The composed decision's `decided_by`, when the endpoint returns one. */
export function decidedByOf(record: DecisionRecord): DecidedBy | undefined {
  return record.rbac?.decided_by ?? record.rebac?.decided_by ?? record.authzen?.context?.decided_by;
}

/** The trace, and whether it's the engines composed (every line names its model) or ABAC's own. */
export function traceOf(record: DecisionRecord): { lines: string[]; composed: boolean } {
  if (record.abac) return { lines: record.abac.trace ?? [], composed: false };
  const ctx = record.authzen?.context as { trace?: unknown } | undefined;
  const lines =
    record.rbac?.trace ?? record.rebac?.trace ?? (Array.isArray(ctx?.trace) ? ctx.trace : []);
  return { lines: lines.filter((l): l is string => typeof l === "string"), composed: true };
}

/** The role grant paths behind a permission check (GET /v1/check, or AuthZEN's context.paths). */
export function grantPathsOf(record: DecisionRecord): RbacExplainPath[] {
  if (record.rbac) return record.rbac.paths ?? [];
  const paths = (record.authzen?.context as { paths?: unknown } | undefined)?.paths;
  return Array.isArray(paths) ? (paths as RbacExplainPath[]) : [];
}

/** The tuples a relationship check walked, root to person (relation check, or AuthZEN's path). */
export function relationPathOf(record: DecisionRecord): RebacPathStep[] {
  if (record.rebac) return record.rebac.path ?? [];
  const path = (record.authzen?.context as { path?: unknown } | undefined)?.path;
  return Array.isArray(path) ? (path as RebacPathStep[]) : [];
}

/** The ABAC policy that decided, when one did and the caller may see which. */
export function decidingPolicyOf(record: DecisionRecord): { id: string; name?: string } | null {
  if (record.abac?.matched_policy_id) {
    const name = record.abac.reason_params?.policy_name;
    return { id: record.abac.matched_policy_id, name: typeof name === "string" ? name : undefined };
  }
  const by = decidedByOf(record);
  if (by?.model === "abac" && by.policy_id) {
    const name = by.reason_params?.policy_name;
    return { id: by.policy_id, name: typeof name === "string" ? name : undefined };
  }
  return null;
}

/** The engine that decided, as its protocol name; null when nothing did. */
export function decidingModelOf(record: DecisionRecord): string | null {
  if (record.engine === "abac") return "ABAC";
  const model = decidedByOf(record)?.model;
  return model === "abac" ? "ABAC" : model === "rbac" ? "RBAC" : model === "rebac" ? "ReBAC" : null;
}
