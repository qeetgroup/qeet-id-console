import type { Capability } from "@/platform/security/capability-model";

/** A resource the current page has surfaced as "the thing being looked at". */
export interface ContextSelection {
  kind: "user" | "role" | "policy" | "oidc_client" | "agent" | "audit_event" | (string & {});
  id: string;
  label?: string;
}

/** What the assistant is told about where the operator is: route, tenant, selection, filters. */
export interface ConsoleContext {
  route: { pathname: string; title: string; group?: string };
  tenantId: string | null;
  userId: string | null;
  /** A hint for the model and UI, never authorization: the backend each tool calls decides. */
  capabilities: Capability[];
  selection?: ContextSelection;
  filters?: Record<string, string>;
}
