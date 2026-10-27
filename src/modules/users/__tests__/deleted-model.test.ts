import { describe, expect, it } from "vitest";

import type { DeletedUser } from "../api/users";
import { daysUntil, deletedSearch, matchesDeleted, purgeAt } from "../deleted-model";
import { DAY_MS } from "../people-model";

const NOW = Date.parse("2026-10-27T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

function deleted(overrides: Partial<DeletedUser> = {}): DeletedUser {
  return {
    id: "u1",
    email: "anil.bhatia@qeet.in",
    display_name: "Anil Bhatia",
    deleted_at: ago(17),
    deleted_by: "admin-1",
    created_at: ago(400),
    ...overrides,
  };
}

describe("purgeAt and daysUntil", () => {
  it("purges people the retention window after they were deleted, and never when it's off", () => {
    const at = purgeAt(deleted(), 90);
    expect(at).toBe(Date.parse(ago(17)) + 90 * DAY_MS);
    expect(daysUntil(at ?? 0, NOW)).toBe(73);
    expect(purgeAt(deleted(), null)).toBeNull();
    expect(daysUntil(NOW - DAY_MS, NOW)).toBe(0);
  });
});

describe("matchesDeleted", () => {
  it("narrows by who deleted them, when they're purged, and the name or email", () => {
    const u = deleted();
    expect(matchesDeleted(u, {}, 90, NOW)).toBe(true);
    expect(matchesDeleted(u, { by: "admin-2" }, 90, NOW)).toBe(false);
    expect(matchesDeleted(u, { purge: "7" }, 90, NOW)).toBe(false);
    expect(matchesDeleted(u, { purge: "later" }, 90, NOW)).toBe(true);
    expect(matchesDeleted(deleted({ deleted_at: ago(85) }), { purge: "7" }, 90, NOW)).toBe(true);
    expect(matchesDeleted(u, { purge: "30" }, null, NOW)).toBe(false);
    expect(matchesDeleted(u, { q: "anil" }, 90, NOW)).toBe(true);
    expect(matchesDeleted(u, { q: "priya" }, 90, NOW)).toBe(false);
  });
});

describe("deletedSearch", () => {
  it("keeps known filters and drops unknown values", () => {
    expect(deletedSearch.parse({ purge: "never", by: "admin-1", q: "anil" })).toEqual({
      by: "admin-1",
      q: "anil",
    });
  });
});
