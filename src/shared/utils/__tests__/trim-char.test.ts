import { describe, expect, it } from "vitest";

import { trimChar, trimEndChar } from "../trim-char";

describe("trimEndChar", () => {
  it("drops the character repeated at the end only", () => {
    expect(trimEndChar("https://api.id.qeet.in///", "/")).toBe("https://api.id.qeet.in");
    expect(trimEndChar("/a/b", "/")).toBe("/a/b");
    expect(trimEndChar("///", "/")).toBe("");
    expect(trimEndChar("abc==", "=")).toBe("abc");
  });

  it("takes a long run in one pass", () => {
    const run = `${"/".repeat(200_000)}x`;
    const started = performance.now();
    expect(trimEndChar(run, "/")).toBe(run);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("trimChar", () => {
  it("drops the character repeated at either end", () => {
    expect(trimChar("--my-view--", "-")).toBe("my-view");
    expect(trimChar("my-view", "-")).toBe("my-view");
    expect(trimChar("----", "-")).toBe("");
  });
});
