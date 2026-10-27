import { describe, expect, it } from "vitest";

import type { LdapConnection } from "@/modules/authentication";
import type { PostureFinding } from "@/modules/authorization";
import type { DirectoryConnection, DirectoryErrorPage } from "@/modules/directory";
import type { Group } from "@/modules/groups";
import {
  directoryAttention,
  failingConnections,
  failureReason,
  groupsItem,
  ldapItem,
  orgShape,
  placesByCountry,
  squarify,
} from "../overview-directory-model";

const NOW = new Date("2026-10-27T10:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
const SERVER = "ldaps://ldap.staging.qeet.in:636";

type ErrorItem = DirectoryErrorPage["items"][number];
const failure = (over: Partial<ErrorItem> = {}) =>
  ({
    connection_id: "c1",
    category: "connection",
    severity: "critical",
    resolution: "open",
    started_at: days(-6),
    message: `${SERVER}: no such host`,
    error_code: "DIR-502",
    ...over,
  }) as ErrorItem;
const errors = (...items: ErrorItem[]) => ({ items }) as DirectoryErrorPage;

const connection = (over: Partial<DirectoryConnection> = {}) =>
  ({
    id: "c1",
    name: "Staging Directory (test)",
    type: "ldap",
    status: "draft",
    serverUrl: SERVER,
    ...over,
  }) as DirectoryConnection;
const ldap = (over: Partial<LdapConnection> = {}) =>
  ({
    id: "c1",
    name: "Staging Directory (test)",
    status: "draft",
    created_at: days(-19),
    ...over,
  }) as LdapConnection;
const group = (name: string, member_count: number) =>
  ({
    id: name,
    tenant_id: "t1",
    name,
    description: "",
    created_at: days(-30),
    member_count,
  }) as Group;
const person = (department?: string, team?: string, location?: string) => ({
  metadata: { department, team, location } as Record<string, unknown>,
});

describe("failingConnections", () => {
  it("keeps open critical connection failures, the newest per connection", () => {
    const failing = failingConnections(
      errors(
        failure({ started_at: days(-9), message: "older" }),
        failure(),
        failure({ connection_id: "c2", resolution: "resolved" }),
        failure({ connection_id: "c3", severity: "warning" }),
        failure({ connection_id: "c4", category: "mapping" }),
      ),
    );
    expect([...failing.keys()]).toEqual(["c1"]);
    expect(failing.get("c1")).toMatchObject({ at: days(-6), message: `${SERVER}: no such host` });
  });

  it("drops the server's address from the cause, and falls back to the code", () => {
    expect(failureReason({ at: "", message: `${SERVER}: no such host`, code: "X" }, SERVER)).toBe(
      "no such host",
    );
    expect(failureReason({ at: "", message: "  ", code: "DIR-502" }, SERVER)).toBe("DIR-502");
  });
});

describe("ldapItem", () => {
  const formatDate = (iso: string) => iso.slice(0, 10);

  it("says a connection whose check fails is failing, however its status reads", () => {
    const failing = failingConnections(errors(failure()));
    expect(ldapItem([ldap()], formatDate, failing, NOW)).toMatchObject({
      state: "failing",
      detail: {
        key: "dashboard:overview.setup.details.checkFailing",
        params: { names: "Staging Directory (test)", count: 6 },
      },
      action: { label: "dashboard:overview.setup.actions.fix" },
    });
    const today = failingConnections(errors(failure({ started_at: days(0) })));
    expect(ldapItem([ldap()], formatDate, today, NOW).detail.key).toBe(
      "dashboard:overview.setup.details.checkFailingToday",
    );
  });

  it("is connected, a draft or not set up when nothing fails", () => {
    expect(ldapItem([ldap({ status: "active" })], formatDate).state).toBe("done");
    expect(ldapItem([ldap()], formatDate).state).toBe("setup");
    expect(ldapItem([], formatDate).state).toBe("none");
    const failing = failingConnections(errors(failure()));
    expect(ldapItem([ldap({ status: "disabled" })], formatDate, failing, NOW).state).toBe("none");
  });
});

describe("groupsItem", () => {
  it("counts the groups no one is in", () => {
    expect(groupsItem([])).toMatchObject({ state: "none", action: { to: "/groups" } });
    expect(groupsItem([group("A", 0), group("B", 3)])).toMatchObject({
      state: "attention",
      detail: {
        key: "dashboard:overview.setup.details.groupsEmpty",
        params: { count: 1, groups: 2 },
      },
    });
    expect(groupsItem([group("A", 0)]).detail.key).toBe(
      "dashboard:overview.setup.details.groupsAllEmpty",
    );
    expect(groupsItem([group("A", 2)])).toMatchObject({ state: "done" });
    expect(groupsItem([group("A", 2)]).action).toBeUndefined();
  });
});

describe("directoryAttention", () => {
  const findings = (wildcard: number, unconditional: number): PostureFinding[] => [
    { id: "wildcard", severity: "high", count: wildcard },
    { id: "unconditional", severity: "medium", count: unconditional },
    { id: "disabled", severity: "info", count: 4 },
    { id: "deny", severity: "info", count: 2 },
  ];

  it("alerts on a connection that can't reach its server, empty groups and authorization risks", () => {
    const items = directoryAttention({
      errors: errors(failure()),
      connections: [connection()],
      groups: [group("Partnerships", 0), group("People", 4), group("Governance", 0)],
      findings: findings(2, 1),
      now: NOW,
    });
    expect(items.map((i) => [i.id, i.severity])).toEqual([
      ["directory-down-c1", "critical"],
      ["groups-empty", "warning"],
      ["authz-wildcard", "warning"],
      ["authz-allow-all", "warning"],
    ]);
    expect(items[0]?.params).toEqual({
      name: "Staging Directory (test)",
      type: "LDAP",
      count: 6,
      reason: "no such host",
    });
    expect(items[1]?.params).toEqual({ count: 2, names: "Partnerships, Governance" });
  });

  it("finds nothing when nothing is wrong, or a failure belongs to no live connection", () => {
    expect(
      directoryAttention({
        errors: errors(failure({ connection_id: "gone" }), failure({ connection_id: "off" })),
        connections: [connection(), connection({ id: "off", status: "disabled" })],
        groups: [group("People", 4)],
        findings: findings(0, 0),
        now: NOW,
      }),
    ).toEqual([]);
    expect(directoryAttention({})).toEqual([]);
  });
});

describe("orgShape", () => {
  it("groups people into departments and teams, biggest first, with no department last", () => {
    const shape = orgShape([
      person("Engineering", "Payments"),
      person("Engineering", "Payments"),
      person("Engineering"),
      person("Sales", "Field"),
      person(),
      person("  ", "Ignored"),
    ]);
    expect(shape.departments).toEqual([
      {
        name: "Engineering",
        count: 3,
        teams: [
          { team: "Payments", count: 2 },
          { team: null, count: 1 },
        ],
      },
      { name: "Sales", count: 1, teams: [{ team: "Field", count: 1 }] },
      { name: null, count: 2, teams: [{ team: null, count: 2 }] },
    ]);
    expect(shape).toMatchObject({ named: 2, noTeam: 1, noDepartment: 2 });
  });
});

describe("placesByCountry", () => {
  it("reads 'City, CC' into countries and their cities, biggest first", () => {
    expect(
      placesByCountry([
        person(undefined, undefined, "Berlin, DE"),
        person(undefined, undefined, "Bengaluru, IN"),
        person(undefined, undefined, "Bengaluru, IN"),
        person(undefined, undefined, "Pune, IN"),
        person(undefined, undefined, "Remote"),
        person(),
      ]),
    ).toEqual([
      {
        country: "IN",
        count: 3,
        cities: [
          { city: "Bengaluru", count: 2 },
          { city: "Pune", count: 1 },
        ],
      },
      { country: "DE", count: 1, cities: [{ city: "Berlin", count: 1 }] },
      { country: "", count: 1, cities: [{ city: "Remote", count: 1 }] },
    ]);
  });
});

describe("squarify", () => {
  const area = (r: { w: number; h: number }) => r.w * r.h;

  it("gives each value its share of the area, inside the rectangle", () => {
    const rect = { x: 0, y: 0, w: 1000, h: 330 };
    const values = [19, 6, 6, 5, 3, 3, 2, 1];
    const rects = squarify(values, rect);
    const total = values.reduce((a, b) => a + b, 0);
    rects.forEach((r, i) => {
      expect(area(r)).toBeCloseTo((area(rect) * (values[i] ?? 0)) / total, 6);
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(1000 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(330 + 1e-9);
    });
    expect(rects.reduce((a, r) => a + area(r), 0)).toBeCloseTo(area(rect), 6);
  });

  it("draws nothing for nothing", () => {
    expect(squarify([0, 0], { x: 0, y: 0, w: 10, h: 10 }).map(area)).toEqual([0, 0]);
    expect(squarify([], { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
  });
});
