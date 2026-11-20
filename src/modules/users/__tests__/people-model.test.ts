import { describe, expect, it } from "vitest";

import type { User } from "../api/users";
import {
  DAY_MS,
  department,
  growth,
  isAdmin,
  recency,
  userQuery,
  usersListSearch,
} from "../people-model";

const NOW = Date.parse("2026-10-27T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

function person(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    organization_id: "t1",
    email: "priya@qeet.in",
    display_name: "Priya Sharma",
    status: "active",
    roles: ["Developer"],
    email_verified_at: ago(300),
    mfa_enabled: true,
    last_seen_at: ago(0.5),
    created_at: ago(300),
    metadata: { department: "Engineering" },
    phone: null,
    avatar_url: null,
    phone_verified_at: null,
    updated_at: "2026-09-01T00:00:00Z",
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
    expect(isAdmin(person({ roles: undefined }))).toBe(false);
  });

  it("reads the department from the person's metadata, ignoring blanks and non-text", () => {
    expect(department(person())).toBe("Engineering");
    expect(department(person({ metadata: { department: "  " } }))).toBeNull();
    expect(department(person({ metadata: { department: 4 } }))).toBeNull();
    expect(department(person({ metadata: null }))).toBeNull();
  });
});

describe("userQuery", () => {
  it("asks the list API for each filter and the search", () => {
    expect(
      userQuery(
        {
          q: " priya ",
          status: "active",
          role: "Admin",
          dept: "Design",
          twostep: "off",
          seen: "week",
        },
        null,
      ),
    ).toEqual({
      q: "priya",
      status: "active",
      role: "Admin",
      department: "Design",
      mfa: "off",
      last_seen: "week",
    });
  });

  it("asks for each look the list API can say", () => {
    expect(userQuery({ look: "dormant" }, null)).toEqual({ last_seen: "older" });
    expect(userQuery({ look: "never" }, null)).toEqual({ last_seen: "never" });
    expect(userQuery({ look: "unverified" }, null)).toEqual({ email_verified: false });
    expect(userQuery({ look: "suspended" }, null)).toEqual({ status: "suspended" });
    expect(userQuery({ look: "admins-no-two-step" }, null)).toEqual({ admins_without_mfa: true });
  });

  it("asks for the people in no group", () => {
    expect(userQuery({ group: "none" }, null)).toEqual({ in_group: false });
  });

  it("is null when a look and a filter can't both hold, so no one matches", () => {
    expect(userQuery({ look: "dormant", seen: "today" }, null)).toBeNull();
    expect(userQuery({ look: "suspended", status: "active" }, null)).toBeNull();
    expect(userQuery({ look: "never", seen: "never" }, null)).toEqual({ last_seen: "never" });
  });

  it("asks for the table's order, leaving out the server's own, newest joined first", () => {
    expect(userQuery({}, { column: "person", direction: "ascending" })).toEqual({
      sort: "name",
      order: "asc",
    });
    expect(userQuery({}, { column: "active", direction: "descending" })).toEqual({
      sort: "last_seen",
      order: "desc",
    });
    expect(userQuery({}, { column: "joined", direction: "ascending" })).toEqual({
      sort: "created",
      order: "asc",
    });
    expect(userQuery({}, { column: "joined", direction: "descending" })).toEqual({});
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
