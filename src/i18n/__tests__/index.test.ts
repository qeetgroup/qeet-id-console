// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import i18n, { humanizeMissingKey } from "../index";

describe("humanizeMissingKey", () => {
  it("takes the last segment of a namespaced/dotted key", () => {
    expect(humanizeMissingKey("secrets.rotateSheet.title")).toBe("Title");
    expect(humanizeMissingKey("auth:secrets.rotateSheet.valueLabel")).toBe("Value Label");
  });

  it("splits camelCase, snake_case and kebab-case into Title Case", () => {
    expect(humanizeMissingKey("createButton")).toBe("Create Button");
    expect(humanizeMissingKey("some_snake_key")).toBe("Some Snake Key");
    expect(humanizeMissingKey("kebab-case-word")).toBe("Kebab Case Word");
  });

  it("falls back to the raw key when there is nothing to humanize", () => {
    expect(humanizeMissingKey("")).toBe("");
  });
});

describe("i18n missing-key handling", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders a humanized fallback instead of the raw dotted key", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // A key present in no locale (not even the `en` source) must not surface raw.
    const out = i18n.t("nope.doesNotExistAtAll");
    expect(out).not.toContain(".");
    expect(out).toBe("Does Not Exist At All");
  });

  it("still resolves existing keys normally (no regression)", () => {
    expect(i18n.t("secrets.description", { ns: "auth" })).toContain("Encrypted vault");
  });
});
