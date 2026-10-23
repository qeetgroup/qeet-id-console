// Every assistant action is a ToolDefinition whose `run` calls the existing authenticated
// endpoints, so the backend's RBAC, tenant isolation and audit apply, never reimplemented.

import type { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import type { Capability } from "@/platform/security/capability-model";
import type { ConsoleContext } from "../../context/types/context.types";

export type ToolCategory = "directory" | "authz" | "credentials" | "audit" | "codegen";

/** A confirmation the user must approve before a tool with a `confirm` builder runs. */
export interface ConfirmRequest {
  title: string;
  body: string;
  /** Concrete resources the action will affect, shown before approval. */
  affected: { label: string; value: string }[];
  confirmText: string;
  tone: "default" | "destructive";
}

export interface ToolResult {
  ok: boolean;
  summary: string; // Model-safe one-line result: sent to the model and rendered
  data?: Record<string, unknown>; // Structured result for rendering; never holds a secret
  /** A secret shown to the operator once; never sent to the model or persisted. */
  sensitiveArtifact?: { kind: "secret" | "private_key"; label: string; value: string };
  error?: { code: string; message: string };
}

export interface ToolContext {
  tenantId: string;
  userId: string;
  console: ConsoleContext;
  /** Client-side capability hint for UX; the backend makes the authorization decision. */
  can: (c?: Capability) => boolean;
  queryClient: QueryClient; // For invalidating the console's cached queries after a change
  signal: AbortSignal;
  /** Opens the confirmation dialog; resolves true on approval. */
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  /**
   * Opens the step-up dialog after a `step_up_required` response; resolves true once a fresh
   * factor is verified, so the engine can run the tool again.
   */
  stepUp: () => Promise<boolean>;
}

export interface ToolDefinition<I = unknown> {
  name: string; // snake_case; must equal the backend's name for the tool
  category: ToolCategory;
  title: string;
  description: string; // Model-facing description
  input: z.ZodType<I>;
  requiredCapability?: Capability;
  destructive: boolean;
  /**
   * True when the tool changes anything, not only when it is destructive. Change tools are
   * withheld while `ASSISTANT_CHANGE_TOOLS_ENABLED` is off.
   */
  mutates: boolean;
  /**
   * Console screen where the operator makes this change themselves. Every
   * change tool names one, so a withheld tool can point the operator there.
   */
  consoleScreen?: { label: string; to: string; hint?: string };
  confirm?: (input: I, ctx: ToolContext) => ConfirmRequest;
  auditLabel: string;
  run: (ctx: ToolContext, input: I) => Promise<ToolResult>;
}

export type ExecutionStatus =
  | "queued"
  | "validating"
  | "awaiting_confirmation"
  | "authorizing"
  | "executing"
  | "awaiting_step_up"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface ToolExecution {
  id: string; // Equals the originating tool_call id
  toolName: string;
  input: unknown;
  status: ExecutionStatus;
  startedAt: number;
  endedAt?: number;
  result?: ToolResult;
  error?: { code: string; message: string };
  attempts: number;
}
