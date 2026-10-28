// The ABAC editor's model: a policy being written, its condition tree and the edits the canvas
// and inspector make to it. Pure functions, so the tree's edits can be tested on their own.

import {
  type AbacPolicy,
  type AbacPolicyInput,
  type CondNode,
  type ConditionJson,
  conditionProblem,
  type Effect,
  fromConditionJson,
  nid,
  toConditionJson,
} from "@/modules/authorization/api/abac";
import type { PolicyDoc, PolicyProblem } from "@/modules/authorization/utils/policy-codegen";

/**
 * A policy as the editor holds it. `condition` null is "Always": the server stores no condition
 * (or `{}`) and every request for the target matches. `requireRole` and `relation` come only from
 * a template; no ABAC condition can hold them, so they block saving until removed.
 */
export interface Draft {
  id?: string;
  name: string;
  description: string;
  effect: Effect;
  resourceType: string;
  action: string;
  priority: number;
  enabled: boolean;
  condition: CondNode | null;
  requireRole: string | null;
  relation: { object: string; relation: string } | null;
}

/** True for a stored condition that matches everything: none, or the empty object `{}`. */
export function isAlways(json: ConditionJson | Record<string, never> | null | undefined): boolean {
  return !json || (typeof json === "object" && Object.keys(json).length === 0);
}

/**
 * A new policy: it starts with one empty condition, so it can't be saved until that names an
 * attribute (or is removed on purpose, which makes the policy apply to every request).
 */
export function newDraft(): Draft {
  return {
    name: "",
    description: "",
    effect: "allow",
    resourceType: "*",
    action: "*",
    priority: 10,
    enabled: true,
    condition: { id: nid("grp"), kind: "group", combinator: "all", children: [blankLeaf()] },
    requireRole: null,
    relation: null,
  };
}

export function draftFromPolicy(p: AbacPolicy): Draft {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    effect: p.effect,
    resourceType: p.resource_type,
    action: p.action,
    priority: p.priority,
    enabled: p.enabled,
    condition: isAlways(p.condition) ? null : fromConditionJson(p.condition),
    requireRole: null,
    relation: null,
  };
}

/** A template's policy, opened as a new draft. */
export function draftFromDoc(doc: PolicyDoc): Draft {
  return {
    name: doc.name,
    description: doc.description,
    effect: doc.effect,
    resourceType: doc.resourceType || "*",
    action: doc.action || "*",
    priority: doc.priority,
    enabled: doc.enabled,
    condition: doc.condition,
    requireRole: doc.requireRole,
    relation: doc.relation,
  };
}

/** The draft as the policy previews (policy language, JSON) read it. */
export function toDoc(d: Draft): PolicyDoc {
  return {
    name: d.name,
    description: d.description,
    effect: d.effect,
    resourceType: d.resourceType,
    action: d.action,
    requireRole: d.requireRole,
    condition: d.condition,
    relation: d.relation,
    priority: d.priority,
    enabled: d.enabled,
  };
}

/** The body POST and PATCH /abac/policies take. A blank target is `*`, for any. */
export function toInput(d: Draft): AbacPolicyInput {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    effect: d.effect,
    resource_type: d.resourceType.trim() || "*",
    action: d.action.trim() || "*",
    condition: d.condition ? toConditionJson(d.condition) : null,
    priority: d.priority,
    enabled: d.enabled,
  };
}

/** Whether the draft differs from what's saved (a new draft always does). */
export function isDirty(d: Draft, saved: AbacPolicy | undefined): boolean {
  if (!saved) return true;
  const a = toInput(d);
  const b = toInput(draftFromPolicy(saved));
  return JSON.stringify(a) !== JSON.stringify(b) || d.requireRole != null || d.relation != null;
}

// An attribute path: a namespace, then a dotted name (the engine resolves nothing else).
const ATTRIBUTE_PATH = /^(subject|resource|context)(\.[^.\s]+)+$/;

/** Why the draft can't be saved yet, or null when it can. */
export type DraftProblem = PolicyProblem | { code: "needsAttribute" };

export function draftProblem(d: Draft): DraftProblem | null {
  if (d.requireRole != null || d.relation != null) return { code: "mixedEngines" };
  if (!d.condition) return null;
  const leafWithout = (n: CondNode): boolean =>
    n.kind === "leaf"
      ? !ATTRIBUTE_PATH.test(n.attr.trim())
      : n.kind === "not"
        ? leafWithout(n.child)
        : n.children.some(leafWithout);
  if (leafWithout(d.condition)) return { code: "needsAttribute" };
  return conditionProblem(d.condition);
}

// ── The condition tree's edits ────────────────────────────────────────────────

export function blankLeaf(): CondNode {
  return { id: nid("leaf"), kind: "leaf", attr: "", op: "eq", value: "" };
}

export function blankGroup(combinator: "all" | "any" = "any"): CondNode {
  return { id: nid("grp"), kind: "group", combinator, children: [blankLeaf()] };
}

/** Returns the node with `id`, or null. */
export function findNode(root: CondNode | null, id: string): CondNode | null {
  if (!root) return null;
  if (root.id === id) return root;
  if (root.kind === "not") return findNode(root.child, id);
  if (root.kind === "group") {
    for (const c of root.children) {
      const found = findNode(c, id);
      if (found) return found;
    }
  }
  return null;
}

/** Returns the group or Not that holds `id`, or null for the root. */
export function parentOf(
  root: CondNode | null,
  id: string,
): Exclude<CondNode, { kind: "leaf" }> | null {
  if (!root || root.kind === "leaf") return null;
  const kids = root.kind === "not" ? [root.child] : root.children;
  for (const c of kids) {
    if (c.id === id) return root;
    const found = parentOf(c, id);
    if (found) return found;
  }
  return null;
}

/** Returns the tree with the node `id` replaced by `fn(node)`. */
export function updateNode(root: CondNode, id: string, fn: (node: CondNode) => CondNode): CondNode {
  if (root.id === id) return fn(root);
  if (root.kind === "not") return { ...root, child: updateNode(root.child, id, fn) };
  if (root.kind === "group")
    return { ...root, children: root.children.map((c) => updateNode(c, id, fn)) };
  return root;
}

/**
 * Returns the tree without the node `id`. A group left empty goes too, and a Not loses what it
 * held with it; removing the root leaves no condition (Always).
 */
export function removeNode(root: CondNode | null, id: string): CondNode | null {
  if (!root || root.id === id) return null;
  if (root.kind === "not") {
    const child = removeNode(root.child, id);
    return child ? { ...root, child } : null;
  }
  if (root.kind === "group") {
    const children = root.children
      .map((c) => removeNode(c, id))
      .filter((c): c is CondNode => c !== null);
    return children.length ? { ...root, children } : null;
  }
  return root;
}

/**
 * Returns the tree with `node` added to the group `into`, or at the top when `into` is unset: a
 * lone condition becomes an All group with it.
 */
export function addNode(root: CondNode | null, node: CondNode, into?: string): CondNode {
  if (!root)
    return node.kind === "group"
      ? node
      : { id: nid("grp"), kind: "group", combinator: "all", children: [node] };
  const target = into ? findNode(root, into) : root;
  if (target?.kind === "group")
    return updateNode(root, target.id, (g) =>
      g.kind === "group" ? { ...g, children: [...g.children, node] } : g,
    );
  return { id: nid("grp"), kind: "group", combinator: "all", children: [root, node] };
}

/** Returns the tree with the node `id` inside a Not. */
export function wrapInNot(root: CondNode, id: string): CondNode {
  return updateNode(root, id, (n) => ({ id: nid("not"), kind: "not", child: n }));
}

/** Returns the tree with the Not `id` replaced by what it holds. */
export function unwrapNot(root: CondNode, id: string): CondNode {
  return updateNode(root, id, (n) => (n.kind === "not" ? n.child : n));
}
