import { describe, expect, it } from "vitest";

import { parseFlagList } from "@/platform/config/public-config";
import { evaluateFlags } from "@/platform/feature-flags/evaluation";
import { flagDefinitions } from "@/platform/modules/registry";

const sources = import.meta.glob<string>(
  ["/src/**/*.{ts,tsx}", "!/src/**/__tests__/**", "!/src/**/*.test.{ts,tsx}"],
  { query: "?raw", import: "default", eager: true },
);

describe("feature flags", () => {
  it("each have an owner, a reason, and an expiry date still ahead unless they are a kill switch", () => {
    const flags = flagDefinitions();
    expect(new Set(flags.map((f) => f.id)).size).toBe(flags.length);
    for (const f of flags) {
      expect(f.owner, f.id).not.toBe("");
      expect(f.description, f.id).not.toBe("");
      // An expired rollout flag is removed, keeping the path that won, not extended.
      if (f.expires !== null)
        expect(new Date(f.expires).getTime(), f.id).toBeGreaterThan(Date.now());
    }
  });

  it("are read only by the ids the modules declare", () => {
    const declared = new Set(flagDefinitions().map((f) => f.id));
    const used = Object.values(sources).flatMap((text) =>
      [...text.matchAll(/useFeatureFlag\(\s*"([^"]+)"/g)].map((m) => m[1] ?? ""),
    );
    expect(used.filter((id) => !declared.has(id))).toEqual([]);
  });

  it("can be turned off at runtime, and an undeclared flag is off", () => {
    expect(evaluateFlags([]).qeetai).toBe(true);
    expect(evaluateFlags(parseFlagList(" qeetai , other ")).qeetai).toBe(false);
    expect(evaluateFlags([])["no-such-flag"]).toBeUndefined();
  });
});
