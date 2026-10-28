import { describe, expect, it } from "vitest";

import type { Org, OrgAuditEvent } from "../api/orgs";
import {
  activityAt,
  byRank,
  changesByMonth,
  changesOf,
  isOwner,
  isStale,
  lookCounts,
  monthLevel,
  orgRows,
  orgsListSearch,
  roleCounts,
  roleOf,
  twoStepShare,
  visibleOrgs,
} from "../orgs-model";

const NOW = Date.parse("2026-10-28T09:00:00Z");
const DAY = 86_400_000;
const reading = { now: NOW, target: 80 };

const org = (id: string, name: string, patch: Partial<Org> = {}): Org => ({
  id,
  slug: name.toLowerCase().replace(/ /g, "-"),
  name,
  status: "active",
  plan: "free",
  region: "ap-south-1",
  logo_url: "",
  created_at: "2025-08-18T09:00:00Z",
  member_count: 10,
  mfa_enabled_count: 9,
  ...patch,
});
const mine = (id: string, roles: string[], daysAgo: number | null, domain = "") => ({
  id,
  name: id,
  slug: id,
  plan: "free",
  region: "ap-south-1",
  logo_url: "",
  domain,
  roles,
  last_used_at: daysAgo === null ? null : new Date(NOW - daysAgo * DAY).toISOString(),
});

const TENANTS = [
  org("g", "Qeet Group", { plan: "enterprise", member_count: 46, mfa_enabled_count: 18 }),
  org("s", "Qeet Sandbox", { member_count: 3, mfa_enabled_count: 0 }),
  org("a", "Acme", { plan: "pro", member_count: 100, mfa_enabled_count: 95 }),
  org("x", "Xeno", { status: "suspended", member_count: 5, mfa_enabled_count: 0 }),
];
const MINE = [
  mine("g", ["Admin"], 1, "qeet.in"),
  mine("s", ["owner"], 7),
  mine("a", ["viewer", "Admin"], 45),
  mine("x", ["Developer"], null),
];
const rows = orgRows(TENANTS, MINE, "g", {
  ...TENANTS[0],
  deletion_due_at: "2026-11-04T09:00:00Z",
} as Org);
const row = (id: string) => {
  const found = rows.find((r) => r.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
};

describe("orgRows", () => {
  it("joins each organisation with the caller's place in it, strongest role first", () => {
    expect(row("g")).toMatchObject({ current: true, domain: "qeet.in", roles: ["Admin"] });
    expect(row("a").roles).toEqual(["Admin", "viewer"]);
    expect(row("s").lastUsedAt).toBe(new Date(NOW - 7 * DAY).toISOString());
  });

  it("takes a scheduled deletion from the current one's record only", () => {
    expect(row("g").deletion_due_at).toBe("2026-11-04T09:00:00Z");
    expect(row("s").deletion_due_at).toBeUndefined();
  });

  it("leaves an organisation without a membership roleless", () => {
    expect(orgRows([org("z", "Zed")], [], null)[0]).toMatchObject({ roles: [], lastUsedAt: null });
  });
});

describe("roles", () => {
  it("ranks owner, then admin, then the rest by name", () => {
    expect(byRank(["viewer", "Admin", "owner", "Auditor"])).toEqual([
      "owner",
      "Admin",
      "Auditor",
      "viewer",
    ]);
  });

  it("shows the strongest, capitalised, and knows an owner", () => {
    expect(roleOf(row("s"))).toBe("Owner");
    expect(isOwner(row("s"))).toBe(true);
    expect(isOwner(row("g"))).toBe(false);
  });

  it("counts the caller's roles across the list, strongest first", () => {
    expect(roleCounts(rows)).toEqual([
      { role: "Owner", count: 1 },
      { role: "Admin", count: 2 },
      { role: "Developer", count: 1 },
    ]);
  });
});

describe("looks", () => {
  it("counts below the target (active, with people), stale, suspended and deleting", () => {
    expect(twoStepShare(row("g"))).toBe(39);
    expect(lookCounts(rows, reading)).toEqual({
      "below-target": 2, // Qeet Group 39%, Sandbox 0%; Xeno is suspended
      stale: 2, // Acme, 45 days; Xeno, never
      suspended: 1,
      deleting: 1,
    });
  });

  it("never counts the organisation you're in as stale", () => {
    expect(isStale({ ...row("g"), lastUsedAt: null }, NOW)).toBe(false);
  });
});

describe("visibleOrgs", () => {
  it("lists by name until a sort is chosen", () => {
    expect(visibleOrgs(rows, {}, null, reading).map((r) => r.id)).toEqual(["a", "g", "s", "x"]);
  });

  it("searches names, URLs and domains", () => {
    expect(visibleOrgs(rows, { q: "qeet.in" }, null, reading).map((r) => r.id)).toEqual(["g"]);
    expect(visibleOrgs(rows, { q: "sandbox" }, null, reading).map((r) => r.id)).toEqual(["s"]);
  });

  it("filters by role, plan, region and look, together", () => {
    expect(visibleOrgs(rows, { role: "admin" }, null, reading).map((r) => r.id)).toEqual([
      "a",
      "g",
    ]);
    expect(
      visibleOrgs(rows, { plan: "free", look: "below-target" }, null, reading).map((r) => r.id),
    ).toEqual(["s"]);
    expect(visibleOrgs(rows, { region: "us-east-1" }, null, reading)).toEqual([]);
  });

  it("sorts by last opened, the current one first and never-opened last", () => {
    const sorted = visibleOrgs(rows, {}, { column: "opened", direction: "descending" }, reading);
    expect(sorted.map((r) => r.id)).toEqual(["g", "s", "a", "x"]);
  });

  it("reads a bad address as no filter", () => {
    expect(orgsListSearch.parse({ look: "nope", q: " " })).toEqual({
      look: undefined,
      q: undefined,
    });
  });
});

describe("history", () => {
  const event = (action: string, at: string, id = action): OrgAuditEvent => ({
    id,
    action,
    resource_type: "tenant",
    created_at: at,
  });
  const events = [
    event("tenant.created", "2025-08-18T09:00:00Z"),
    event("security_policy.updated", "2026-09-15T09:00:00Z"),
    event("social.signup_refused", "2026-10-01T09:00:00Z"),
    event("branding.updated", "2025-08-20T09:00:00Z"),
  ];

  it("keeps the changes, newest first, and leaves out what isn't one", () => {
    expect(changesOf(events).map((e) => e.action)).toEqual([
      "security_policy.updated",
      "branding.updated",
      "tenant.created",
    ]);
  });

  it("counts them by month from the month it was made to now", () => {
    const months = changesByMonth(changesOf(events), "2025-08-18T09:00:00Z", NOW);
    expect(months).toHaveLength(15);
    expect(months[0]?.count).toBe(2);
    expect(months[13]?.count).toBe(1);
    expect(months.map((m) => monthLevel(m.count)).filter(Boolean)).toEqual([2, 1]);
  });

  it("opens one change in Activity with its day loaded", () => {
    const at = activityAt({ id: "e1", created_at: "2026-09-15T09:00:00Z" });
    expect(at).toMatchObject({ range: "custom", event: "e1" });
    expect(Date.parse(at.to) - Date.parse(at.from)).toBe(DAY - 1);
  });
});
