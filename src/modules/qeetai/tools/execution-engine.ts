import type { Capability } from "@/platform/security/capability-model";
import { errorMessage } from "@/platform/errors/user-message";
import { isStepUpRequired } from "@/platform/security/step-up";
import type {
  ConfirmRequest,
  ToolContext,
  ToolDefinition,
  ToolExecution,
  ToolResult,
} from "./types/tool.types";

export type { ExecutionStatus, ToolExecution } from "./types/tool.types";
export type { ConfirmRequest };

export interface ExecuteToolOptions {
  /** The model's tool_call id; kept across retries, so all attempts share one timeline entry. */
  id: string;
  /** Called synchronously with a fresh snapshot after every status change. */
  onTransition?: (exec: ToolExecution) => void;
  timeoutMs?: number; // Time budget for each run() attempt, in ms; defaults to 30 000
  /** Prior attempts, 0 on the first try; pass `previous.attempts` when retrying. */
  previousAttempts?: number;
}

function makeError(code: string, message: string): { code: string; message: string } {
  return { code, message };
}

/**
 * Runs a tool through validation, confirmation (when it has a `confirm` builder), the capability
 * check and execution, reporting each status to `onTransition`. Never throws: it resolves to a
 * succeeded, failed, timed_out or cancelled execution, and aborting `ctx.signal` cancels it.
 */
export async function executeTool(
  tool: ToolDefinition,
  rawInput: unknown,
  ctx: ToolContext,
  opts: ExecuteToolOptions,
): Promise<ToolExecution> {
  const { id, onTransition, timeoutMs = 30_000, previousAttempts = 0 } = opts;

  // Each transition replaces this object, so a snapshot already reported never changes.
  let exec: ToolExecution = {
    id,
    toolName: tool.name,
    input: rawInput,
    status: "queued",
    startedAt: Date.now(),
    attempts: previousAttempts + 1,
  };

  function transition(
    status: ToolExecution["status"],
    patch?: Partial<Pick<ToolExecution, "result" | "error" | "endedAt">>,
  ): ToolExecution {
    exec = { ...exec, status, ...patch };
    onTransition?.(exec);
    return exec;
  }

  function terminal(
    status: Extract<ToolExecution["status"], "succeeded" | "failed" | "timed_out" | "cancelled">,
    patch?: Partial<Pick<ToolExecution, "result" | "error">>,
  ): ToolExecution {
    return transition(status, { ...patch, endedAt: Date.now() });
  }

  transition("validating");

  if (ctx.signal.aborted) {
    return terminal("cancelled");
  }

  const parsed = tool.input.safeParse(rawInput);
  if (!parsed.success) {
    return terminal("failed", {
      error: makeError(
        "validation_error",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      ),
    });
  }

  // Parsed to the tool's own input type; `tool` is the registry's type-erased definition, so
  // confirm/run accept it as-is.
  const validatedInput: unknown = parsed.data;

  // Gate on `confirm`, not `destructive` (which only styles the dialog), so non-destructive
  // changes such as privilege grants still need a person's approval.
  if (tool.confirm) {
    transition("awaiting_confirmation");

    if (ctx.signal.aborted) {
      return terminal("cancelled");
    }

    const confirmReq: ConfirmRequest = tool.confirm(validatedInput, ctx);
    let confirmed = false;
    try {
      confirmed = await ctx.confirm(confirmReq);
    } catch {
      // A dialog that throws (e.g. unmounted) counts as a denial.
      confirmed = false;
    }

    if (ctx.signal.aborted) {
      return terminal("cancelled");
    }

    if (!confirmed) {
      return terminal("cancelled");
    }
  }

  transition("authorizing");

  if (ctx.signal.aborted) {
    return terminal("cancelled");
  }

  if (tool.requiredCapability && !ctx.can(tool.requiredCapability as Capability)) {
    // A pre-flight check for a clear error; the backend endpoint run() calls still decides.
    return terminal("failed", {
      error: makeError(
        "capability_denied",
        `This action requires the "${tool.requiredCapability}" capability, which is not granted to your account.`,
      ),
    });
  }

  transition("executing");

  if (ctx.signal.aborted) {
    return terminal("cancelled");
  }

  // One run() attempt, racing a fresh timeout so retries get a full budget.
  async function runAttempt(): Promise<ToolResult> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_res, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new DOMException("Tool execution timed out", "TimeoutError")),
        timeoutMs,
      );
    });
    try {
      return await Promise.race([tool.run(ctx, validatedInput), timeoutPromise]);
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    }
  }

  // On `step_up_required`, wait in awaiting_step_up for ctx.stepUp() and run once more; any
  // other failure is terminal.
  let result: ToolResult | null = null;
  for (let attempt = 0; attempt < 2 && result === null; attempt++) {
    try {
      result = await runAttempt();
    } catch (err: unknown) {
      if (ctx.signal.aborted) {
        return terminal("cancelled");
      }

      if (attempt === 0 && isStepUpRequired(err)) {
        transition("awaiting_step_up");
        let verified = false;
        try {
          verified = await ctx.stepUp();
        } catch {
          verified = false;
        }
        if (ctx.signal.aborted) return terminal("cancelled");
        if (!verified) return terminal("cancelled");
        transition("executing");
        continue;
      }

      const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
      if (isTimeout) {
        return terminal("timed_out", {
          error: makeError("timeout", `Tool "${tool.name}" exceeded the ${timeoutMs}ms budget.`),
        });
      }

      // Curated copy, never the thrown message: an ApiError carries backend text, and this error
      // is shown, persisted and sent to the model.
      return terminal("failed", {
        error: makeError("execution_error", errorMessage(err)),
      });
    }
  }

  if (result === null) {
    return terminal("cancelled");
  }

  if (!result.ok) {
    return terminal("failed", {
      result,
      error: result.error ?? makeError("tool_error", result.summary),
    });
  }

  return terminal("succeeded", { result });
}
