import { describe, expect, it } from "vitest";

// Every hand-written source file, as text. Tests and the generated route tree are exempt.
const sources = import.meta.glob<string>(
  [
    "/src/**/*.{ts,tsx}",
    "!/src/**/__tests__/**",
    "!/src/**/*.test.{ts,tsx}",
    "!/src/routeTree.gen.ts",
  ],
  { query: "?raw", import: "default", eager: true },
);

// Past this a file holds more than one idea; split it into cohesive siblings instead.
const MAX_LINES = 500;

describe("source files", () => {
  it("scans the source", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200);
  });

  it(`keeps every file within ${MAX_LINES} lines`, () => {
    const oversized = Object.entries(sources)
      .map(
        ([path, text]) => [path, text.split("\n").length - (text.endsWith("\n") ? 1 : 0)] as const,
      )
      .filter(([, lines]) => lines > MAX_LINES)
      .map(([path, lines]) => `${path} (${lines})`);
    expect(oversized).toEqual([]);
  });
});
