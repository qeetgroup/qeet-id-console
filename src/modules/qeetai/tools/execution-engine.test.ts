import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "@/platform/errors/api-error";
import { executeTool } from "./execution-engine";
import type { ToolContext, ToolDefinition, ToolResult } from "./tool-types";

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    tenantId: "t_1",
    userId: "u_1",
    console: {} as ToolContext["console"],
    can: () => true,
    queryClient: {} as QueryClient,
    signal: new AbortController().signal,
    confirm: vi.fn(async () => true),
    stepUp: vi.fn(async () => true),
    ...overrides,
  };
}

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "demo",
    category: "directory",
    title: "Demo",
    description: "",
    input: z.object({}),
    destructive: false,
    auditLabel: "qeetai.demo",
    run: async (): Promise<ToolResult> => ({ ok: true, summary: "done" }),
    ...overrides,
  } as ToolDefinition;
}

const opts = { id: "call_1" };

describe("executeTool", () => {
  it("fails validation when input does not match the schema", async () => {
    const tool = makeTool({ input: z.object({ x: z.string() }) });
    const exec = await executeTool(tool, {}, makeCtx(), opts);
    expect(exec.status).toBe("failed");
    expect(exec.error?.code).toBe("validation_error");
  });

  it("succeeds for a valid, unconfirmed, authorized tool", async () => {
    const exec = await executeTool(makeTool(), {}, makeCtx(), opts);
    expect(exec.status).toBe("succeeded");
    expect(exec.result?.summary).toBe("done");
  });

  it("prompts for confirmation whenever a confirm builder is present (even if destructive:false)", async () => {
    const confirm = vi.fn(async () => true);
    const tool = makeTool({
      destructive: false,
      confirm: () => ({ title: "t", body: "b", affected: [], confirmText: "ok", tone: "default" }),
    });
    const exec = await executeTool(tool, {}, makeCtx({ confirm }), opts);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(exec.status).toBe("succeeded");
  });

  it("cancels when confirmation is denied", async () => {
    const tool = makeTool({
      confirm: () => ({ title: "t", body: "b", affected: [], confirmText: "ok", tone: "default" }),
    });
    const exec = await executeTool(tool, {}, makeCtx({ confirm: vi.fn(async () => false) }), opts);
    expect(exec.status).toBe("cancelled");
  });

  it("does NOT prompt when there is no confirm builder", async () => {
    const confirm = vi.fn(async () => true);
    await executeTool(makeTool(), {}, makeCtx({ confirm }), opts);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("denies (terminal) when the operator lacks the required capability", async () => {
    const tool = makeTool({ requiredCapability: "user.write" });
    const exec = await executeTool(tool, {}, makeCtx({ can: () => false }), opts);
    expect(exec.status).toBe("failed");
    expect(exec.error?.code).toBe("capability_denied");
  });

  it("recovers from step_up_required: pauses, verifies, retries once, succeeds", async () => {
    let attempts = 0;
    const stepUp = vi.fn(async () => true);
    const tool = makeTool({
      run: async () => {
        attempts += 1;
        if (attempts === 1) throw new ApiError(403, "step_up_required", "needs mfa");
        return { ok: true, summary: "done after step-up" };
      },
    });
    const statuses: string[] = [];
    const exec = await executeTool(tool, {}, makeCtx({ stepUp }), {
      id: "call_1",
      onTransition: (e) => statuses.push(e.status),
    });
    expect(stepUp).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(2);
    expect(exec.status).toBe("succeeded");
    expect(statuses).toContain("awaiting_step_up");
  });

  it("cancels when step-up is declined", async () => {
    const tool = makeTool({
      run: async () => {
        throw new ApiError(403, "step_up_required", "needs mfa");
      },
    });
    const exec = await executeTool(tool, {}, makeCtx({ stepUp: vi.fn(async () => false) }), opts);
    expect(exec.status).toBe("cancelled");
  });

  it("marks a thrown non-step-up error as failed/execution_error", async () => {
    const tool = makeTool({
      run: async () => {
        throw new Error("boom");
      },
    });
    const exec = await executeTool(tool, {}, makeCtx(), opts);
    expect(exec.status).toBe("failed");
    expect(exec.error?.code).toBe("execution_error");
  });
});
