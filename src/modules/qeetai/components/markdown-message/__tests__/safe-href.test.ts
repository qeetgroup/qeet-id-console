import { describe, expect, it } from "vitest";

import { safeHref } from "../markdown-message";

// Link targets come from model output, which can echo attacker-controlled tool
// data. A relative link must stay on this origin however it is spelled.
describe("safeHref", () => {
  it("keeps same-origin paths", () => {
    expect(safeHref("/users/123?tab=sessions#top")).toBe("/users/123?tab=sessions#top");
  });

  it("keeps http(s) and mailto links", () => {
    expect(safeHref("https://docs.qeet.in/id")).toBe("https://docs.qeet.in/id");
    expect(safeHref("mailto:support@qeet.in")).toBe("mailto:support@qeet.in");
  });

  it.each([
    "//evil.example/phish",
    "/\\evil.example/phish",
    "/\t/evil.example/phish",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "users/123",
  ])("rejects %j", (href) => {
    expect(safeHref(href)).toBeUndefined();
  });
});
