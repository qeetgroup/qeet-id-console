import { describe, expect, it } from "vitest";

import type { User } from "../api/users";
import {
  countBy,
  DAY_MS,
  department,
  growth,
  isAdmin,
  matches,
  needsLook,
  recency,
  sortPeople,
  usersListSearch,
} from "../people-model";

const NOW = Date.parse("2026-10-27T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

function person(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    tenant_id: "t1",
    email: "priya@qeet.in",
    display_name: "Priya Sharma",
    status: "active",
    roles: ["Developer"],
    email_verified_at: ago(300),
    mfa_enabled: true,
    last_seen_at: ago(0.5),
    created_at: ago(300),
    metadata: { department: "Engineering" },
    ...overrides,
  };
}

describe("recency", () => {
  it("puts each person in one step from today to never", () => {
    expect(recency(person({ last_seen_at: ago(0.5) }), NOW)).toBe("today");
    expect(recency(person({ last_seen_at: ago(1) }), NOW)).toBe("week");
    expect(recency(person({ last_seen_at: ago(6.9) }), NOW)).toBe("week");
    expect(recency(person({ last_seen_at: ago(7) }), NOW)).toBe("month");
    expect(recency(person({ last_seen_at: ago(30) }), NOW)).toBe("older");
    expect(recency(person({ last_seen_at: null }), NOW)).toBe("never");
  });
});

describe("isAdmin and department", () => {
  it("counts the owner and Admin roles as running the organisation, not Billing Admin", () => {
    expect(isAdmin(person({ roles: ["owner"] }))).toBe(true);
    expect(isAdmin(person({ roles: ["Member", "Admin"] }))).toBe(true);
    expect(isAdmin(person({ roles: ["Billing Admin"] }))).toBe(false);
    expect(isAdmin(person({ roles: null }))).toBe(false);
  });

  it("reads the department from the person's metadata, ignoring blanks and non-text", () => {
    expect(department(person())).toBe("Engineering");
    expect(department(person({ metadata: { department: "  " } }))).toBeNull();
    expect(department(person({ metadata: { department: 4 } }))).toBeNull();
    expect(department(person({ metadata: null }))).toBeNull();
  });
});

describe("needsLook", () => {
  it("flags an admin without two-step, but not a member without it", () => {
    expect(
      needsLook(person({ roles: ["Admin"], mfa_enabled: false }), "admins-no-two-step", NOW),
    ).toBe(true);
    expect(needsLook(person({ mfa_enabled: false }), "admins-no-two-step", NOW)).toBe(false);
  });

  it("flags people not seen for 30 days, never signed in, unverified or suspended", () => {
    expect(needsLook(person({ last_seen_at: ago(45) }), "dormant", NOW)).toBe(true);
    expect(needsLook(person({ last_seen_at: null }), "dormant", NOW)).toBe(false);
    expect(needsLook(person({ last_seen_at: null }), "never", NOW)).toBe(true);
    expect(needsLook(person({ email_verified_at: null }), "unverified", NOW)).toBe(true);
    expect(needsLook(person({ status: "suspended" }), "suspended", NOW)).toBe(true);
    expect(needsLook(person(), "suspended", NOW)).toBe(false);
  });
});

describe("matches", () => {
  it("keeps everyone with no filters", () => {
    expect(matches(person(), {}, NOW)).toBe(true);
  });

  it("narrows by role, department, two-step, last active and what needs a look, together", () => {
    const u = person({ roles: ["Admin"], mfa_enabled: false, last_seen_at: ago(3) });
    expect(matches(u, { role: "Admin" }, NOW)).toBe(true);
    expect(matches(u, { role: "Developer" }, NOW)).toBe(false);
    expect(matches(u, { dept: "Design" }, NOW)).toBe(false);
    expect(matches(u, { twostep: "off" }, NOW)).toBe(true);
    expect(matches(u, { twostep: "on" }, NOW)).toBe(false);
    expect(matches(u, { seen: "week" }, NOW)).toBe(true);
    expect(matches(u, { seen: "today" }, NOW)).toBe(false);
    expect(matches(u, { look: "admins-no-two-step", dept: "Engineering" }, NOW)).toBe(true);
    expect(matches(u, { look: "admins-no-two-step", dept: "Design" }, NOW)).toBe(false);
  });

  it("searches the name, email, phone and ID, ignoring case", () => {
    const u = person({ phone: "+91 98450 12345", id: "6607bc8c" });
    expect(matches(u, { q: "PRIYA" }, NOW)).toBe(true);
    expect(matches(u, { q: "qeet.in" }, NOW)).toBe(true);
    expect(matches(u, { q: "98450" }, NOW)).toBe(true);
    expect(matches(u, { q: "6607" }, NOW)).toBe(true);
    expect(matches(u, { q: "sowmya" }, NOW)).toBe(false);
  });
});

describe("countBy", () => {
  it("counts each value, most first and then by name, leaving out blanks", () => {
    expect(countBy(["Design", "Engineering", null, "Engineering", "Admin", undefined])).toEqual([
      ["Engineering", 2],
      ["Admin", 1],
      ["Design", 1],
    ]);
  });
});

describe("growth", () => {
  it("counts the people who had joined by the end of each month, ending with this one", () => {
    const users = [
      person({ created_at: "2025-08-10T00:00:00Z" }),
      person({ created_at: "2026-09-15T00:00:00Z" }),
      person({ created_at: "2026-10-20T00:00:00Z" }),
    ];
    const months = growth(users, NOW, 15);
    expect(months).toHaveLength(15);
    // August 2025 is the first month shown; October 2026 the last.
    expect(months[0]).toBe(1);
    expect(months[13]).toBe(2);
    expect(months[14]).toBe(3);
  });
});

describe("sortPeople", () => {
  const a = person({ id: "a", display_name: "Ananya", last_seen_at: null, created_at: ago(10) });
  const b = person({ id: "b", display_name: "bala", last_seen_at: ago(1), created_at: ago(20) });
  const c = person({ id: "c", display_name: "Chitra", last_seen_at: ago(5), created_at: ago(5) });

  it("keeps the server's order without a sort", () => {
    expect(sortPeople([c, a, b], null).map((u) => u.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by name ignoring case, and by last active with never as the longest ago", () => {
    expect(
      sortPeople([c, a, b], { column: "person", direction: "ascending" }).map((u) => u.id),
    ).toEqual(["a", "b", "c"]);
    expect(
      sortPeople([c, a, b], { column: "active", direction: "descending" }).map((u) => u.id),
    ).toEqual(["b", "c", "a"]);
    expect(
      sortPeople([c, a, b], { column: "joined", direction: "ascending" }).map((u) => u.id),
    ).toEqual(["b", "a", "c"]);
  });
});

describe("usersListSearch", () => {
  it("keeps known filters and drops blank or unknown values, so a stale address still opens", () => {
    expect(
      usersListSearch.parse({
        q: "priya",
        role: "Admin",
        dept: " ",
        twostep: "maybe",
        seen: "week",
        look: "everyone",
        action: "create",
      }),
    ).toEqual({ q: "priya", role: "Admin", seen: "week", action: "create" });
  });
});
