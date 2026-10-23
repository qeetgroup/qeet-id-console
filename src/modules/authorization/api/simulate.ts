// Each authorization engine is a one-shot mutation that returns a DecisionRecord, so any
// engine's answer renders the same way.

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { AbacDecision } from "./abac";
import type { DecidedBy, ReasonFields } from "./decision";

export type Engine = "authzen" | "abac" | "rbac" | "rebac";

export interface RbacExplainPath {
  permission: string;
  granted_by: string;
  via: string;
  group_id?: string;
  role_id: string;
}
/** GET /v1/check?explain=true response; the reason fields are set on a denial. */
export interface RbacExplain extends ReasonFields {
  allowed: boolean;
  paths: RbacExplainPath[];
  decided_by?: DecidedBy;
  trace?: string[];
}

export interface RebacPathStep {
  object: string;
  relation: string;
  subject: string;
  depth: number;
}
export interface RebacExplain {
  allowed: boolean;
  path?: RebacPathStep[];
  decided_by?: DecidedBy;
  trace?: string[];
}

export interface AuthzenResult {
  decision: boolean;
  context?: Record<string, unknown> & { decided_by?: DecidedBy };
}

/** One engine's decision in a common shape, with its explain payload and measured latency. */
export interface DecisionRecord {
  id: string;
  engine: Engine;
  allowed: boolean;
  at: string;
  durationMs: number;
  reason?: string;
  failed?: boolean; // the request itself failed, so there is no decision
  input: Record<string, unknown>;
  authzen?: AuthzenResult;
  abac?: AbacDecision;
  rbac?: RbacExplain;
  rebac?: RebacExplain;
}

function rid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // fall back to a time-based id
  }
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ data: T; durationMs: number }> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const data = await fn();
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return { data, durationMs: Math.round((t1 - t0) * 10) / 10 };
}

export interface AuthzenInput {
  subject: { type: string; id: string };
  resource: { type: string; id: string };
  action: string;
  context?: Record<string, unknown>;
}

export interface AbacInput {
  subject: Record<string, unknown>;
  resource: { type: string; id: string; attrs?: Record<string, unknown> };
  action: string;
  context?: Record<string, unknown>;
}

export interface RbacInput {
  user_id: string;
  permission: string;
}

export interface RebacInput {
  object: string;
  relation: string;
  user_id: string;
}

async function callAuthzen(tenantId: string, input: AuthzenInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    api<AuthzenResult>(`/v1/tenants/${tenantId}/access/v1/evaluation`, {
      method: "POST",
      body: {
        subject: input.subject,
        resource: input.resource,
        action: { name: input.action },
        context: { explain: true, ...(input.context ?? {}) },
      },
    }),
  );
  return {
    id: rid(),
    engine: "authzen",
    allowed: data.decision,
    at: new Date().toISOString(),
    durationMs,
    input: input as unknown as Record<string, unknown>,
    authzen: data,
  };
}

async function callAbac(tenantId: string, input: AbacInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    api<AbacDecision>(`/v1/tenants/${tenantId}/abac/evaluate`, {
      method: "POST",
      body: input,
      query: { explain: "true" },
    }),
  );
  return {
    id: rid(),
    engine: "abac",
    allowed: data.allow,
    at: new Date().toISOString(),
    durationMs,
    reason: data.reason,
    input: input as unknown as Record<string, unknown>,
    abac: data,
  };
}

async function callRbac(tenantId: string, input: RbacInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    api<RbacExplain>("/v1/check", {
      query: {
        user_id: input.user_id,
        tenant_id: tenantId,
        permission: input.permission,
        explain: "true",
      },
    }),
  );
  return {
    id: rid(),
    engine: "rbac",
    allowed: data.allowed,
    at: new Date().toISOString(),
    durationMs,
    reason: data.reason,
    input: input as unknown as Record<string, unknown>,
    rbac: data,
  };
}

async function callRebac(tenantId: string, input: RebacInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    api<RebacExplain>(`/v1/tenants/${tenantId}/relation-tuples/check`, {
      method: "POST",
      body: input,
      query: { explain: "true" },
    }),
  );
  return {
    id: rid(),
    engine: "rebac",
    allowed: data.allowed,
    at: new Date().toISOString(),
    durationMs,
    input: input as unknown as Record<string, unknown>,
    rebac: data,
  };
}

export function useAuthzenEvaluate() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (input: AuthzenInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return callAuthzen(tenantId, input);
    },
    meta: { silent: true },
  });
}

export function useAbacSimulate() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (input: AbacInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return callAbac(tenantId, input);
    },
    meta: { silent: true },
  });
}

export function useRbacSimulate() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (input: RbacInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return callRbac(tenantId, input);
    },
    meta: { silent: true },
  });
}

export function useRebacSimulate() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (input: RebacInput) => {
      if (!tenantId) throw new Error("No tenant selected");
      return callRebac(tenantId, input);
    },
    meta: { silent: true },
  });
}

export const BATCH_CAP = 50;

/**
 * Evaluates up to BATCH_CAP subjects against the AuthZEN endpoint, six at a time: there is no
 * batch API, so this fans out in the browser. A failed request is recorded as a deny.
 */
export function useBatchSimulate() {
  const tenantId = useTenantId();
  const [results, setResults] = useState<DecisionRecord[]>([]);
  const [isRunning, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  async function run(
    subjects: { type: string; id: string }[],
    resource: { type: string; id: string },
    action: string,
    context?: Record<string, unknown>,
  ) {
    if (!tenantId) return;
    // Bound after the guard so the hoisted `worker` below sees the narrowed type.
    const scopedTenantId = tenantId;
    const capped = subjects.slice(0, BATCH_CAP);
    setRunning(true);
    setResults([]);
    setProgress(0);
    const out: DecisionRecord[] = [];
    const concurrency = 6; // Six at a time, to stay gentle on the decision point
    // One iterator shared by every worker, so each [index, subject] is handed out exactly once.
    const queue = capped.entries();
    async function worker() {
      for (const [i, subject] of queue) {
        try {
          out[i] = await callAuthzen(scopedTenantId, {
            subject,
            resource,
            action,
            context,
          });
        } catch {
          out[i] = {
            id: rid(),
            engine: "authzen",
            allowed: false,
            at: new Date().toISOString(),
            durationMs: 0,
            failed: true,
            input: { subject, resource, action },
          };
        }
        setProgress((p) => p + 1);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, capped.length) }, worker));
    setResults(out.filter(Boolean));
    setRunning(false);
  }

  return { run, results, isRunning, progress };
}
