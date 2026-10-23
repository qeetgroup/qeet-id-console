// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatLocale } from "../index";

describe("formatLocale", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the reader's locale when it shares the console's language", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-IN");
    expect(formatLocale()).toBe("en-IN");
    expect((123456).toLocaleString(formatLocale())).toBe("1,23,456");
  });

  it("uses the console's language when the reader's is another one", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
    expect(formatLocale()).toBe("en");
    const date = new Date(Date.UTC(2026, 7, 16, 12));
    expect(date.toLocaleDateString(formatLocale(), { month: "long", timeZone: "UTC" })).toBe(
      "August",
    );
  });
});
