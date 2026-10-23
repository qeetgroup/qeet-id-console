// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => session.tenantId }));

import { api } from "@/platform/api/client";
import {
  BATCH_CAP,
  type DecisionRecord,
  useAbacSimulate,
  useAuthzenEvaluate,
  useBatchSimulate,
  useRbacSimulate,
  useRebacSimulate,
} from "../api/simulate";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function expectRecordEnvelope(record: DecisionRecord) {
  expect(typeof record.id).toBe("string");
  expect(record.id).not.toBe("");
  expect(Number.isNaN(Date.parse(record.at))).toBe(false);
  expect(record.durationMs).toBeGreaterThanOrEqual(0);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.tenantId = "tenant-a";
});

afterEach(cleanup);

describe("single-engine simulators", () => {
  it("evaluates AuthZEN against the tenant PDP with explain on and a named action", async () => {
    vi.mocked(api).mockResolvedValue({ decision: true, context: { reason_admin: "role" } });
    const { result } = renderHook(() => useAuthzenEvaluate(), { wrapper });

    const input = {
      subject: { type: "user", id: "u1" },
      resource: { type: "document", id: "d1" },
      action: "read",
      context: { ip: "10.0.0.1" },
    };
    let record: DecisionRecord | undefined;
    await act(async () => {
      record = await result.current.mutateAsync(input);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/access/v1/evaluation", {
      method: "POST",
      body: {
        subject: { type: "user", id: "u1" },
        resource: { type: "document", id: "d1" },
        action: { name: "read" },
        context: { explain: true, ip: "10.0.0.1" },
      },
    });
    assert(record, "record");
    expect(record).toMatchObject({
      engine: "authzen",
      allowed: true,
      input,
      authzen: { decision: true, context: { reason_admin: "role" } },
    });
    expectRecordEnvelope(record);
  });

  it("evaluates ABAC with the explain trace and carries the reason", async () => {
    const decision = {
      allow: false,
      effect: "deny",
      matched_policy_id: "p1",
      reason: "denied by policy",
      trace: ["p1 matched"],
    };
    vi.mocked(api).mockResolvedValue(decision);
    const { result } = renderHook(() => useAbacSimulate(), { wrapper });

    const input = {
      subject: { id: "u1", dept: "eng" },
      resource: { type: "payment", id: "pay1", attrs: { amount: 10 } },
      action: "approve",
    };
    let record: DecisionRecord | undefined;
    await act(async () => {
      record = await result.current.mutateAsync(input);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/abac/evaluate", {
      method: "POST",
      body: input,
      query: { explain: "true" },
    });
    assert(record, "record");
    expect(record).toMatchObject({
      engine: "abac",
      allowed: false,
      reason: "denied by policy",
      input,
      abac: decision,
    });
    expectRecordEnvelope(record);
  });

  it("checks RBAC through the explain endpoint, scoping the query to the tenant", async () => {
    const explain = {
      allowed: true,
      reason: "granted",
      paths: [{ permission: "users.read", granted_by: "admin", via: "direct", role_id: "r1" }],
    };
    vi.mocked(api).mockResolvedValue(explain);
    const { result } = renderHook(() => useRbacSimulate(), { wrapper });

    let record: DecisionRecord | undefined;
    await act(async () => {
      record = await result.current.mutateAsync({ user_id: "u1", permission: "users.read" });
    });

    expect(api).toHaveBeenCalledWith("/v1/check", {
      query: { user_id: "u1", tenant_id: "tenant-a", permission: "users.read", explain: "true" },
    });
    assert(record, "record");
    expect(record).toMatchObject({
      engine: "rbac",
      allowed: true,
      reason: "granted",
      rbac: explain,
    });
    expectRecordEnvelope(record);
  });

  it("checks a ReBAC relation with the resolved path", async () => {
    const explain = {
      allowed: true,
      path: [{ object: "doc:1", relation: "viewer", subject: "user:u1", depth: 0 }],
    };
    vi.mocked(api).mockResolvedValue(explain);
    const { result } = renderHook(() => useRebacSimulate(), { wrapper });

    const input = { object: "doc:1", relation: "viewer", user_id: "u1" };
    let record: DecisionRecord | undefined;
    await act(async () => {
      record = await result.current.mutateAsync(input);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/relation-tuples/check", {
      method: "POST",
      body: input,
      query: { explain: "true" },
    });
    assert(record, "record");
    expect(record).toMatchObject({ engine: "rebac", allowed: true, input, rebac: explain });
    expectRecordEnvelope(record);
  });

  it("refuses every single-engine evaluation without a tenant instead of calling the API", async () => {
    session.tenantId = null;
    const authzen = renderHook(() => useAuthzenEvaluate(), { wrapper }).result.current;
    const abac = renderHook(() => useAbacSimulate(), { wrapper }).result.current;
    const rbac = renderHook(() => useRbacSimulate(), { wrapper }).result.current;
    const rebac = renderHook(() => useRebacSimulate(), { wrapper }).result.current;
    const resource = { type: "doc", id: "1" };

    await act(async () => {
      await expect(
        authzen.mutateAsync({ subject: { type: "user", id: "u1" }, resource, action: "read" }),
      ).rejects.toThrow("No tenant selected");
      await expect(abac.mutateAsync({ subject: {}, resource, action: "read" })).rejects.toThrow(
        "No tenant selected",
      );
      await expect(rbac.mutateAsync({ user_id: "u1", permission: "users.read" })).rejects.toThrow(
        "No tenant selected",
      );
      await expect(
        rebac.mutateAsync({ object: "doc:1", relation: "viewer", user_id: "u1" }),
      ).rejects.toThrow("No tenant selected");
    });
    expect(api).not.toHaveBeenCalled();
  });

  it("surfaces a failed single evaluation as a rejected mutation", async () => {
    const failure = new Error("pdp down");
    vi.mocked(api).mockRejectedValue(failure);
    const { result } = renderHook(() => useAbacSimulate(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          subject: {},
          resource: { type: "doc", id: "1" },
          action: "read",
        }),
      ).rejects.toBe(failure);
    });
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface PendingCall {
  subjectId: string;
  body: unknown;
  path: string;
  settle: Deferred<unknown>;
}

/** Parks every api() call on a deferred, so the test decides when and how each settles. */
function controlTransport() {
  const calls: PendingCall[] = [];
  let settled = 0;
  let maxInFlight = 0;
  vi.mocked(api).mockImplementation((path, options) => {
    const settle = deferred<unknown>();
    const body = options?.body as { subject: { id: string } };
    calls.push({ subjectId: body.subject.id, body, path, settle });
    maxInFlight = Math.max(maxInFlight, calls.length - settled);
    return settle.promise.finally(() => {
      settled += 1;
    });
  });
  return {
    calls,
    maxInFlight: () => maxInFlight,
    allow(subjectId: string) {
      const call = calls.find((c) => c.subjectId === subjectId);
      assert(call, `call for ${subjectId}`);
      call.settle.resolve({ decision: subjectId.endsWith("-ok") });
    },
    fail(subjectId: string) {
      const call = calls.find((c) => c.subjectId === subjectId);
      assert(call, `call for ${subjectId}`);
      call.settle.reject(new Error("boom"));
    },
  };
}

function subjects(n: number, suffix = "-ok") {
  return Array.from({ length: n }, (_, i) => ({ type: "user", id: `u${i}${suffix}` }));
}

const RESOURCE = { type: "document", id: "doc-1" };

describe("useBatchSimulate", () => {
  it("does nothing without a tenant", async () => {
    session.tenantId = null;
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });

    await act(async () => {
      await result.current.run(subjects(3), RESOURCE, "read");
    });

    expect(api).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ results: [], isRunning: false, progress: 0 });
  });

  it("keeps at most six evaluations in flight and evaluates each subject exactly once", async () => {
    const transport = controlTransport();
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });
    const input = subjects(14);

    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.run(input, RESOURCE, "read");
    });

    expect(transport.calls).toHaveLength(6);
    expect(result.current.isRunning).toBe(true);

    // Free one slot: exactly one more evaluation starts.
    transport.allow("u0-ok");
    await waitFor(() => expect(transport.calls).toHaveLength(7));
    expect(transport.maxInFlight()).toBe(6);

    // Drain the rest as they arrive.
    for (let i = 1; i < input.length; i += 1) {
      const id = `u${i}-ok`;
      await waitFor(() => expect(transport.calls.some((c) => c.subjectId === id)).toBe(true));
      transport.allow(id);
    }
    await act(async () => {
      await done;
    });

    expect(transport.maxInFlight()).toBe(6);
    expect(transport.calls.map((c) => c.subjectId).sort()).toEqual(input.map((s) => s.id).sort());
    expect(result.current.isRunning).toBe(false);
  });

  it("returns results in input order even when evaluations finish out of order", async () => {
    const transport = controlTransport();
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });
    const input = [
      { type: "user", id: "a-ok" },
      { type: "user", id: "b-no" },
      { type: "user", id: "c-ok" },
    ];

    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.run(input, RESOURCE, "read");
    });
    transport.allow("c-ok");
    transport.allow("b-no");
    transport.allow("a-ok");
    await act(async () => {
      await done;
    });

    expect(result.current.results.map((r) => [r.input.subject, r.allowed])).toEqual([
      [{ type: "user", id: "a-ok" }, true],
      [{ type: "user", id: "b-no" }, false],
      [{ type: "user", id: "c-ok" }, true],
    ]);
    expect(result.current.results.every((r) => r.engine === "authzen")).toBe(true);
  });

  it("sends each subject through the AuthZEN evaluation with the shared resource, action and context", async () => {
    const transport = controlTransport();
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });

    act(() => {
      void result.current.run(subjects(2), RESOURCE, "delete", { ip: "10.0.0.1" });
    });

    expect(transport.calls.map((c) => [c.path, c.body])).toEqual([
      [
        "/v1/tenants/tenant-a/access/v1/evaluation",
        {
          subject: { type: "user", id: "u0-ok" },
          resource: RESOURCE,
          action: { name: "delete" },
          context: { explain: true, ip: "10.0.0.1" },
        },
      ],
      [
        "/v1/tenants/tenant-a/access/v1/evaluation",
        {
          subject: { type: "user", id: "u1-ok" },
          resource: RESOURCE,
          action: { name: "delete" },
          context: { explain: true, ip: "10.0.0.1" },
        },
      ],
    ]);
    transport.allow("u0-ok");
    transport.allow("u1-ok");
    await waitFor(() => expect(result.current.isRunning).toBe(false));
  });

  it("records a failed evaluation as a 'request failed' deny without stopping the batch", async () => {
    const transport = controlTransport();
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });
    const input = [
      { type: "user", id: "a-ok" },
      { type: "user", id: "b-err" },
      { type: "user", id: "c-ok" },
    ];

    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.run(input, RESOURCE, "read", { ip: "10.0.0.1" });
    });
    transport.fail("b-err");
    transport.allow("a-ok");
    transport.allow("c-ok");
    await act(async () => {
      await done;
    });

    const [first, failed, last] = result.current.results;
    expect(result.current.results).toHaveLength(3);
    expect(first).toMatchObject({ allowed: true });
    expect(last).toMatchObject({ allowed: true });
    expect(failed).toMatchObject({
      engine: "authzen",
      allowed: false,
      durationMs: 0,
      reason: "request failed",
      input: { subject: { type: "user", id: "b-err" }, resource: RESOURCE, action: "read" },
    });
    expect(failed?.authzen).toBeUndefined();
    expect(result.current.progress).toBe(3);
  });

  it("counts progress per finished subject, failures included", async () => {
    const transport = controlTransport();
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });

    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.run(subjects(4), RESOURCE, "read");
    });
    expect(result.current.progress).toBe(0);

    transport.allow("u0-ok");
    await waitFor(() => expect(result.current.progress).toBe(1));
    transport.fail("u1-ok");
    await waitFor(() => expect(result.current.progress).toBe(2));
    expect(result.current.isRunning).toBe(true);
    expect(result.current.results).toEqual([]);

    transport.allow("u2-ok");
    transport.allow("u3-ok");
    await act(async () => {
      await done;
    });
    expect(result.current.progress).toBe(4);
    expect(result.current.results).toHaveLength(4);
  });

  it(`evaluates only the first ${BATCH_CAP} subjects`, async () => {
    expect(BATCH_CAP).toBe(50);
    vi.mocked(api).mockImplementation(async (_path, options) => {
      const body = options?.body as { subject: { id: string } };
      return { decision: body.subject.id !== "u0-ok" };
    });
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });
    const input = subjects(BATCH_CAP + 10);

    await act(async () => {
      await result.current.run(input, RESOURCE, "read");
    });

    expect(api).toHaveBeenCalledTimes(BATCH_CAP);
    expect(result.current.results).toHaveLength(BATCH_CAP);
    expect(result.current.results.map((r) => (r.input.subject as { id: string }).id)).toEqual(
      input.slice(0, BATCH_CAP).map((s) => s.id),
    );
    expect(result.current.progress).toBe(BATCH_CAP);
  });

  it("clears the previous run's results and progress when a new batch starts", async () => {
    vi.mocked(api).mockResolvedValue({ decision: true });
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });
    await act(async () => {
      await result.current.run(subjects(2), RESOURCE, "read");
    });
    expect(result.current.results).toHaveLength(2);

    const transport = controlTransport();
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.run(subjects(1), RESOURCE, "write");
    });
    expect(result.current).toMatchObject({ results: [], progress: 0, isRunning: true });

    transport.allow("u0-ok");
    await act(async () => {
      await done;
    });
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]?.input).toMatchObject({ action: "write" });
  });

  it("finishes immediately with no results for an empty subject list", async () => {
    const { result } = renderHook(() => useBatchSimulate(), { wrapper });
    await act(async () => {
      await result.current.run([], RESOURCE, "read");
    });
    expect(api).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ results: [], isRunning: false, progress: 0 });
  });
});
