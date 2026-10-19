import { describe, expect, it } from "vitest";

import { localDateTimeToInstant } from "../format";

describe("localDateTimeToInstant", () => {
  it("turns a datetime-local value into the RFC 3339 UTC instant of that local moment", () => {
    const instant = localDateTimeToInstant("2026-11-01T10:30");
    expect(instant).toBe(new Date(2026, 10, 1, 10, 30).toISOString());
    expect(instant).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns null for an empty or unreadable value", () => {
    expect(localDateTimeToInstant("")).toBeNull();
    expect(localDateTimeToInstant("not a date")).toBeNull();
  });
});
