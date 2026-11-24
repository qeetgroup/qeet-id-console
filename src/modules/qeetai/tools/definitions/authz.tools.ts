import { z } from "zod";

import i18n from "@/i18n";
import { type AuthPolicy, authKeys, authPolicyQueries } from "@/modules/authentication";
import { backend } from "@/platform/api/backend";
import type { Body } from "@/platform/api/contract";
import type { ToolDefinition } from "../types/tool.types";

type AuthzenBody = Body<"/v1/organizations/{organizationID}/access/v1/evaluation", "post">;
type AbacBody = Body<"/v1/organizations/{organizationID}/abac/evaluate", "post">;

const simulateAuthorizationInput = z.object({
  engine: z.enum(["authzen", "abac", "rbac", "rebac"]),
  subject: z.unknown(),
  resource: z.unknown(),
  action: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});
type SimulateAuthorizationInput = z.infer<typeof simulateAuthorizationInput>;

type SimulateResult = {
  allowed: boolean;
  reason?: string;
  explain?: unknown;
  durationMs?: number;
};

async function runAuthzenEval(
  organizationId: string,
  input: SimulateAuthorizationInput,
  signal: AbortSignal,
): Promise<SimulateResult> {
  const t0 = Date.now();
  const data = await backend.post("/v1/organizations/{organizationID}/access/v1/evaluation", {
    path: { organizationID: organizationId },
    // The assistant's subject and resource go as it gave them; the server checks their shape.
    body: {
      subject: input.subject as AuthzenBody["subject"],
      resource: input.resource as AuthzenBody["resource"],
      action: { name: input.action },
      context: { explain: true, ...(input.context ?? {}) },
    },
    signal,
  });
  return {
    allowed: data.decision === true, // no decision is a refusal
    explain: data.context,
    durationMs: Date.now() - t0,
  };
}

async function runAbacEval(
  organizationId: string,
  input: SimulateAuthorizationInput,
  signal: AbortSignal,
): Promise<SimulateResult> {
  const t0 = Date.now();
  const data = await backend.post("/v1/organizations/{organizationID}/abac/evaluate", {
    path: { organizationID: organizationId },
    body: {
      subject: input.subject as AbacBody["subject"],
      resource: input.resource as AbacBody["resource"],
      action: input.action,
    },
    query: { explain: true },
    signal,
  });
  return {
    allowed: data.allow === true,
    reason: data.reason,
    explain: data.trace,
    durationMs: Date.now() - t0,
  };
}

async function runRbacCheck(
  organizationId: string,
  input: SimulateAuthorizationInput,
  signal: AbortSignal,
): Promise<SimulateResult> {
  const t0 = Date.now();
  // RBAC takes the subject as a user id (or an object's `id`) and the action as a permission.
  const userId =
    typeof input.subject === "string"
      ? input.subject
      : (((input.subject as Record<string, unknown>)?.id as string) ?? "");
  const data = await backend.get("/v1/check", {
    query: {
      user_id: userId,
      organization_id: organizationId,
      permission: input.action,
      explain: "true",
    },
    signal,
  });
  return {
    allowed: data.allowed === true,
    reason: data.reason,
    explain: data.paths,
    durationMs: Date.now() - t0,
  };
}

async function runRebacCheck(
  organizationId: string,
  input: SimulateAuthorizationInput,
  signal: AbortSignal,
): Promise<SimulateResult> {
  const t0 = Date.now();
  const userId =
    typeof input.subject === "string"
      ? input.subject
      : (((input.subject as Record<string, unknown>)?.id as string) ?? "");
  const resourceObj = input.resource as Record<string, unknown> | null;
  const objectStr =
    typeof input.resource === "string"
      ? input.resource
      : `${resourceObj?.type ?? ""}:${resourceObj?.id ?? ""}`;
  const data = await backend.post("/v1/organizations/{organizationID}/relation-tuples/check", {
    path: { organizationID: organizationId },
    body: { object: objectStr, relation: input.action, user_id: userId },
    query: { explain: "true" },
    signal,
  });
  return {
    allowed: data.allowed === true,
    explain: data.path,
    durationMs: Date.now() - t0,
  };
}

export const simulateAuthorizationTool: ToolDefinition<SimulateAuthorizationInput> = {
  name: "simulate_authorization",
  category: "authz",
  title: "qeetai:tools.titles.simulateAuthorization",
  description:
    "Evaluate whether a subject may perform an action on a resource using a chosen decision engine (AuthZEN/ABAC/RBAC/ReBAC). Returns the decision plus an explain trace. Read-only — nothing is changed.",
  input: simulateAuthorizationInput,
  requiredCapability: "role.read",
  destructive: false,
  mutates: false,
  auditLabel: "qeetai.simulate_authorization",
  async run(ctx, input) {
    let result: SimulateResult;
    switch (input.engine) {
      case "authzen":
        result = await runAuthzenEval(ctx.organizationId, input, ctx.signal);
        break;
      case "abac":
        result = await runAbacEval(ctx.organizationId, input, ctx.signal);
        break;
      case "rbac":
        result = await runRbacCheck(ctx.organizationId, input, ctx.signal);
        break;
      case "rebac":
        result = await runRebacCheck(ctx.organizationId, input, ctx.signal);
        break;
    }
    const verdict = result.allowed ? "ALLOW" : "DENY";
    return {
      ok: true,
      summary: `${input.engine.toUpperCase()} decision: ${verdict}${result.reason ? ` — ${result.reason}` : ""}${result.durationMs !== undefined ? ` (${result.durationMs}ms)` : ""}.`,
      // The card shows the verdict only: `reason` can be the server's own sentence.
      display: {
        key: result.allowed
          ? "qeetai:toolCallCard.results.decisionAllowed"
          : "qeetai:toolCallCard.results.decisionDenied",
        values: { engine: input.engine.toUpperCase() },
      },
      data: {
        engine: input.engine,
        allowed: result.allowed,
        reason: result.reason,
        explain: result.explain,
        duration_ms: result.durationMs,
      },
    };
  },
};

const setStrictMfaInput = z.object({ enabled: z.boolean() });
type SetStrictMfaInput = z.infer<typeof setStrictMfaInput>;

export const setStrictMfaTool: ToolDefinition<SetStrictMfaInput> = {
  name: "set_strict_mfa",
  category: "authz",
  title: "qeetai:tools.titles.setStrictMfa",
  description:
    "Toggle strict MFA for the tenant by disabling adaptive device-remembering (remember_device_enabled). When strict, every sign-in must complete MFA with no adaptive skip.",
  input: setStrictMfaInput,
  requiredCapability: "policy.write",
  destructive: false,
  mutates: true,
  consoleScreen: {
    label: "qeetai:tools.screens.passwordless",
    to: "/auth/login-methods/passwordless",
  },
  confirm: (input) => ({
    title: input.enabled
      ? i18n.t("qeetai:tools.confirm.setStrictMfa.enforceTitle")
      : i18n.t("qeetai:tools.confirm.setStrictMfa.disableTitle"),
    body: input.enabled
      ? i18n.t("qeetai:tools.confirm.setStrictMfa.enforceBody")
      : i18n.t("qeetai:tools.confirm.setStrictMfa.disableBody"),
    affected: [
      {
        label: i18n.t("qeetai:tools.fields.strictMfa"),
        value: input.enabled
          ? i18n.t("qeetai:tools.values.enabled")
          : i18n.t("qeetai:tools.values.disabled"),
      },
    ],
    confirmText: input.enabled
      ? i18n.t("qeetai:tools.confirm.setStrictMfa.enforceAction")
      : i18n.t("qeetai:tools.confirm.setStrictMfa.disableTitle"),
    tone: input.enabled ? "default" : "destructive",
  }),
  auditLabel: "qeetai.set_strict_mfa",
  async run(ctx, input) {
    // The PUT replaces the whole policy, so read it first. Strict MFA = no remembered devices.
    // Read fresh and checked: a field missing here would be reset by the PUT.
    const current = await ctx.queryClient.fetchQuery({
      ...authPolicyQueries.detail(ctx.organizationId),
      staleTime: 0,
    });
    const next: AuthPolicy = { ...current, remember_device_enabled: !input.enabled };
    await backend.put("/v1/organizations/{organizationID}/auth-policy", {
      path: { organizationID: ctx.organizationId },
      body: next,
      signal: ctx.signal,
    });
    void ctx.queryClient.invalidateQueries({ queryKey: authKeys.policy(ctx.organizationId) });
    return {
      ok: true,
      summary: input.enabled
        ? "Strict MFA enabled — every sign-in must complete MFA (device-remembering disabled)."
        : "Strict MFA disabled — adaptive device-remembering is now allowed.",
      display: {
        key: input.enabled
          ? "qeetai:toolCallCard.results.strictMfaEnabled"
          : "qeetai:toolCallCard.results.strictMfaDisabled",
      },
      data: {
        strict_mfa_enabled: input.enabled,
        remember_device_enabled: !input.enabled,
      },
    };
  },
};
