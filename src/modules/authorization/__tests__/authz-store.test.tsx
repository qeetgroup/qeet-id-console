// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DecisionRecord } from "../api/simulate";
import {
  authzStore,
  clearHistory,
  pushDecision,
  rememberObjects,
  setBuilderDoc,
  useBuilderDoc,
  useDecisionHistory,
  useLatestDecision,
} from "../store/authz-store";
import { emptyPolicyDoc } from "../utils/policy-codegen";

function decision(id: string, allowed = true): DecisionRecord {
  return {
    id,
    engine: "abac",
    allowed,
    at: "2026-10-01T00:00:00Z",
    durationMs: 1,
    input: {},
  };
}

beforeEach(() => {
  clearHistory();
  setBuilderDoc(null);
});

afterEach(cleanup);

describe("decision history", () => {
  it("keeps the newest decision first", () => {
    pushDecision(decision("first"));
    pushDecision(decision("second"));
    expect(authzStore.state.history.map((d) => d.id)).toEqual(["second", "first"]);
  });

  it("keeps only the 25 most recent decisions", () => {
    for (let i = 1; i <= 30; i += 1) pushDecision(decision(`d${i}`));
    const ids = authzStore.state.history.map((d) => d.id);
    expect(ids).toHaveLength(25);
    expect(ids[0]).toBe("d30");
    expect(ids.at(-1)).toBe("d6");
  });

  it("clears the history without dropping the builder document", () => {
    const doc = emptyPolicyDoc();
    setBuilderDoc(doc);
    pushDecision(decision("d1"));
    clearHistory();
    expect(authzStore.state).toMatchObject({ history: [], builderDoc: doc });
  });
});

describe("relationship objects", () => {
  it("keeps the objects opened newest first, once each", () => {
    rememberObjects(["document:readme"]);
    rememberObjects(["folder:finance", "document:readme"]);
    expect(authzStore.state.objects.slice(0, 2)).toEqual(["folder:finance", "document:readme"]);
  });
});

describe("builder hand-off", () => {
  it("sets and clears the in-flight builder document without touching history", () => {
    pushDecision(decision("d1"));
    const doc = { ...emptyPolicyDoc(), name: "from_template" };
    setBuilderDoc(doc);
    expect(authzStore.state.builderDoc).toBe(doc);
    setBuilderDoc(null);
    expect(authzStore.state.builderDoc).toBeNull();
    expect(authzStore.state.history.map((d) => d.id)).toEqual(["d1"]);
  });
});

describe("store hooks", () => {
  it("has no latest decision until one is pushed, then follows the newest", () => {
    const latest = renderHook(() => useLatestDecision());
    const history = renderHook(() => useDecisionHistory());
    expect(latest.result.current).toBeNull();
    expect(history.result.current).toEqual([]);

    act(() => pushDecision(decision("d1", false)));
    expect(latest.result.current?.id).toBe("d1");

    act(() => pushDecision(decision("d2")));
    expect(latest.result.current?.id).toBe("d2");
    expect(history.result.current.map((d) => d.id)).toEqual(["d2", "d1"]);

    act(() => clearHistory());
    expect(latest.result.current).toBeNull();
  });

  it("re-renders builder consumers when a template hands off a document", () => {
    const { result } = renderHook(() => useBuilderDoc());
    expect(result.current).toBeNull();
    const doc = { ...emptyPolicyDoc(), name: "from_template" };
    act(() => setBuilderDoc(doc));
    expect(result.current).toBe(doc);
  });
});
