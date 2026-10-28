// UI state shared across the authorization screens: recent decisions, so Testing lists what any
// tool just checked; the template a policy starts from, so a template opens in ABAC's new policy;
// and the relationship objects opened, which the server can't list yet. Server state stays in
// TanStack Query. All of it lives in this tab only, and goes on sign-out.

import { Store, useStore } from "@tanstack/react-store";

import { onSessionClear } from "@/platform/auth/session-store";
import type { PolicyDoc } from "../utils/policy-codegen";
import type { DecisionRecord } from "../api/simulate";

interface AuthzState {
  history: DecisionRecord[];
  builderDoc: PolicyDoc | null;
  objects: string[];
}

const HISTORY_LIMIT = 25;
const OBJECTS_LIMIT = 40;
const EMPTY: AuthzState = { history: [], builderDoc: null, objects: [] };

export const authzStore = new Store<AuthzState>(EMPTY);

// Decisions, drafts and objects belong to the organisation and person that made them.
onSessionClear(() => authzStore.setState(() => EMPTY));

export function pushDecision(record: DecisionRecord): void {
  authzStore.setState((s) => ({
    ...s,
    history: [record, ...s.history].slice(0, HISTORY_LIMIT),
  }));
}

export function clearHistory(): void {
  authzStore.setState((s) => ({ ...s, history: [] }));
}

export function setBuilderDoc(doc: PolicyDoc | null): void {
  authzStore.setState((s) => ({ ...s, builderDoc: doc }));
}

export function useDecisionHistory(): DecisionRecord[] {
  return useStore(authzStore, (s) => s.history);
}

export function useLatestDecision(): DecisionRecord | null {
  return useStore(authzStore, (s) => s.history[0] ?? null);
}

export function useBuilderDoc(): PolicyDoc | null {
  return useStore(authzStore, (s) => s.builderDoc);
}

/** Keeps relationship objects ("type:id") opened or reached, newest first, without repeats. */
export function rememberObjects(objects: readonly string[]): void {
  if (objects.length === 0) return;
  authzStore.setState((s) => {
    const next = [...new Set([...objects, ...s.objects])].slice(0, OBJECTS_LIMIT);
    return next.join("\n") === s.objects.join("\n") ? s : { ...s, objects: next };
  });
}

export function useKnownObjects(): string[] {
  return useStore(authzStore, (s) => s.objects);
}
