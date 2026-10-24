import { describe, expect, it } from "vitest";

import { assertProductionConfig, productionConfigProblems } from "../server-config";

const SECRET = "s".repeat(40);
const VALID = {
  SESSION_SECRET: SECRET,
  SERVER_URL: "http://qeet-id-server:4001",
  PUBLIC_API_URL: "https://api.id.qeet.in",
};

describe("production configuration", () => {
  it("accepts a complete configuration, including a private http backend", () => {
    expect(productionConfigProblems(VALID, "")).toEqual([]);
  });

  it("accepts the build-time API URL Vercel uses in place of the runtime ones", () => {
    expect(
      productionConfigProblems(
        { SESSION_SECRET: SECRET, VITE_API_URL: "https://api.id.qeet.in" },
        "https://api.id.qeet.in",
      ),
    ).toEqual([]);
  });

  it.each([
    ["a missing session secret", { ...VALID, SESSION_SECRET: undefined }, /SESSION_SECRET/],
    ["a short session secret", { ...VALID, SESSION_SECRET: "short" }, /SESSION_SECRET/],
    ["no backend URL", { ...VALID, SERVER_URL: undefined }, /SERVER_URL/],
    ["a malformed backend URL", { ...VALID, SERVER_URL: "qeet-id-server:4001" }, /SERVER_URL/],
    ["no public API URL", { ...VALID, PUBLIC_API_URL: undefined }, /PUBLIC_API_URL/],
    ["a non-http public API URL", { ...VALID, PUBLIC_API_URL: "ftp://api" }, /PUBLIC_API_URL/],
  ])("rejects %s", (_label, source, problem) => {
    expect(productionConfigProblems(source, "")).toEqual([expect.stringMatching(problem)]);
  });

  it("refuses to start without naming any value", () => {
    const source = { SESSION_SECRET: "leaky-short-secret", SERVER_URL: "not a url" };

    expect(() => assertProductionConfig(source, "")).toThrow(/Refusing to start/);
    try {
      assertProductionConfig(source, "");
    } catch (error) {
      expect(String(error)).not.toContain("leaky-short-secret");
      expect(String(error)).not.toContain("not a url");
    }
  });
});
