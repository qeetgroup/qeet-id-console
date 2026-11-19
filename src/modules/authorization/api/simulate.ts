// Each authorization engine is a one-shot mutation that returns a DecisionRecord, so any
// engine's answer renders the same way.

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useOrganizationId } from "@/platform/auth/session";
import type { z } from "zod";

import { assuredList } from "@/platform/api/assured";
import type { AbacDecision } from "./abac";
import { checkAnswer, type ExplainPath, type ExplainResult } from "./access-check";
import type { DecidedBy } from "./decision";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { randomHex } from "@/shared/utils/random-hex";

export type Engine = "authzen" | "abac" | "rbac" | "rebac";

export type RbacExplain = ExplainResult;
export type RbacExplainPath = ExplainPath;

// The server always sends each hop's fields; the document marks them optional (QTID-1063).
const relationCheck = assuredList<
  Answer<"/v1/organizations/{organizationID}/relation-tuples/check", "post">
>()("path", "object", "relation", "subject", "depth");
export type RebacExplain = z.infer<typeof relationCheck>;
export type RebacPathStep = NonNullable<RebacExplain["path"]>[number];

// The document gives `context` as an empty object; the server sends decided_by in it, and with
// explain the grant paths or relation path and the trace (QTID-1063).
export type AuthzenResult = Omit<
  Answer<"/v1/organizations/{organizationID}/access/v1/evaluation", "post">,
  "context"
> & { context?: { decided_by?: DecidedBy } & Record<string, unknown> };

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
  return `d_${Date.now().toString(36)}_${randomHex(4)}`;
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

async function callAuthzen(organizationId: string, input: AuthzenInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    backend.post("/v1/organizations/{organizationID}/access/v1/evaluation", {
      path: { organizationID: organizationId },
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
    allowed: data.decision === true, // no decision is a refusal
    at: new Date().toISOString(),
    durationMs,
    input: input as unknown as Record<string, unknown>,
    authzen: data,
  };
}

async function callAbac(organizationId: string, input: AbacInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    backend.post("/v1/organizations/{organizationID}/abac/evaluate", {
      path: { organizationID: organizationId },
      body: input,
      query: { explain: true },
    }),
  );
  return {
    id: rid(),
    engine: "abac",
    allowed: data.allow === true,
    at: new Date().toISOString(),
    durationMs,
    reason: data.reason,
    input: input as unknown as Record<string, unknown>,
    abac: data,
  };
}

async function callRbac(organizationId: string, input: RbacInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    backend.get("/v1/check", {
      query: {
        user_id: input.user_id,
        organization_id: organizationId,
        permission: input.permission,
        explain: "true",
      },
      schema: checkAnswer,
    }),
  );
  return {
    id: rid(),
    engine: "rbac",
    allowed: data.allowed === true,
    at: new Date().toISOString(),
    durationMs,
    reason: data.reason,
    input: input as unknown as Record<string, unknown>,
    rbac: data,
  };
}

async function callRebac(organizationId: string, input: RebacInput): Promise<DecisionRecord> {
  const { data, durationMs } = await timed(() =>
    backend.post("/v1/organizations/{organizationID}/relation-tuples/check", {
      path: { organizationID: organizationId },
      body: input,
      query: { explain: "true" },
      schema: relationCheck,
    }),
  );
  return {
    id: rid(),
    engine: "rebac",
    allowed: data.allowed === true,
    at: new Date().toISOString(),
    durationMs,
    input: input as unknown as Record<string, unknown>,
    rebac: data,
  };
}

export function useAuthzenEvaluate() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (input: AuthzenInput) => {
      if (!organizationId) throw new Error("No tenant selected");
      return callAuthzen(organizationId, input);
    },
    meta: { silent: true },
  });
}

export function useAbacSimulate() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (input: AbacInput) => {
      if (!organizationId) throw new Error("No tenant selected");
      return callAbac(organizationId, input);
    },
    meta: { silent: true },
  });
}

export function useRbacSimulate() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (input: RbacInput) => {
      if (!organizationId) throw new Error("No tenant selected");
      return callRbac(organizationId, input);
    },
    meta: { silent: true },
  });
}

export function useRebacSimulate() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (input: RebacInput) => {
      if (!organizationId) throw new Error("No tenant selected");
      return callRebac(organizationId, input);
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
  const organizationId = useOrganizationId();
  const [results, setResults] = useState<DecisionRecord[]>([]);
  const [isRunning, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  async function run(
    subjects: { type: string; id: string }[],
    resource: { type: string; id: string },
    action: string,
    context?: Record<string, unknown>,
  ) {
    if (!organizationId) return;
    // Bound after the guard so the hoisted `worker` below sees the narrowed type.
    const scopedOrganizationId = organizationId;
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
          out[i] = await callAuthzen(scopedOrganizationId, {
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
