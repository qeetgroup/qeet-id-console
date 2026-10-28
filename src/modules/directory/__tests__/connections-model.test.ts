import { describe, expect, it } from "vitest";

import type { DirectoryEvent } from "../api/directory";
import {
  dailyColumns,
  healthCounts,
  healthState,
  hostOf,
  latestProblems,
  missingKinds,
  peopleSources,
  problemText,
  shownConnection,
} from "../connections-model";
import type { DirectoryConnection } from "../directory-model";

const NOW = Date.parse("2026-10-28T09:00:00Z");
const DAY = 86_400_000;

const connection = (patch: Partial<DirectoryConnection>): DirectoryConnection => ({
  id: "c",
  name: "Corporate AD",
  reference: "c",
  type: "ldap",
  status: "active",
  health: "healthy",
  environment: null,
  scope: "users-on-signin",
  createdAt: null,
  lastActivityAt: null,
  lastSyncAt: null,
  userCount: null,
  groupCount: null,
  serverUrl: "ldaps://ad.corp.acme.in:636",
  ...patch,
});
const SCIM = connection({
  id: "scim:t",
  type: "scim",
  status: "configured",
  userCount: 1240,
  serverUrl: null,
});
const AD = connection({ id: "ad" });
const STAGING = connection({ id: "st", status: "draft", health: "unknown" });
const failing = connection({ id: "f", health: "failed" });

const event = (patch: Partial<DirectoryEvent>): DirectoryEvent =>
  ({
    id: "e",
    connection_id: "st",
    operation: "test",
    trigger: "manual",
    resource_type: "connection",
    resource_id: "",
    started_at: new Date(NOW - DAY).toISOString(),
    duration_ms: 100,
    http_status: 502,
    status: "failed",
    users_synced: 0,
    groups_synced: 0,
    error_code: "DIR-502",
    message: "ldaps://ldap.staging.qeet.in:636: no such host",
    category: "connection",
    severity: "critical",
    resolution: "open",
    resolved_at: null,
    retry_of: null,
    retryable: true,
    ...patch,
  }) as DirectoryEvent;

describe("health", () => {
  it("reads the server's health in three words", () => {
    expect([AD, failing, STAGING].map(healthState)).toEqual(["healthy", "failing", "unchecked"]);
    expect(healthState(connection({ health: "warning" }))).toBe("failing");
    expect(healthCounts([AD, failing, STAGING, SCIM])).toEqual({
      healthy: 2,
      failing: 1,
      unchecked: 1,
    });
  });
});

describe("where people come from", () => {
  it("counts SCIM's people, and LDAP's as unknown while the server doesn't count them", () => {
    expect(peopleSources([SCIM, AD, STAGING], 1606)).toEqual({
      scim: 1240,
      ldap: null,
      fromDirectories: 1240,
      here: 366,
    });
  });

  it("adds LDAP's people once the server counts them", () => {
    expect(peopleSources([SCIM, { ...AD, userCount: 312 }], 1606)).toMatchObject({
      ldap: 312,
      fromDirectories: 1552,
      here: 54,
    });
  });

  it("never says fewer than none are managed here", () => {
    expect(peopleSources([SCIM], 100).here).toBe(0);
  });
});

describe("problems", () => {
  it("keeps each connection's newest open problem, in plain words", () => {
    const older = event({ id: "old", started_at: new Date(NOW - 20 * DAY).toISOString() });
    const newer = event({ id: "new" });
    const problems = latestProblems([older, newer, event({ id: "x", connection_id: "other" })]);
    expect(problems.get("st")?.id).toBe("new");
    expect(problems.size).toBe(2);
    expect(problemText(newer)).toBe("no such host");
  });
});

describe("the last 30 days", () => {
  it("lays the server's volume and the failed events over one column a day", () => {
    const yesterday = new Date(NOW - DAY).toISOString().slice(0, 10);
    const days = dailyColumns([{ date: yesterday, users: 3, groups: 1 }], [event({})], NOW);
    expect(days).toHaveLength(30);
    expect(days.at(-1)?.date).toBe(new Date(NOW).toISOString().slice(0, 10));
    expect(days.at(-2)).toEqual({ date: yesterday, changes: 4, failed: 1 });
    expect(days.reduce((sum, d) => sum + d.changes, 0)).toBe(4);
  });
});

describe("the list", () => {
  it("offers each kind not set up", () => {
    expect(missingKinds([STAGING])).toEqual(["scim"]);
    expect(missingKinds([])).toEqual(["scim", "ldap"]);
    expect(missingKinds([SCIM, AD])).toEqual([]);
  });

  it("narrows to failing connections or drafts, from the address", () => {
    const all = [SCIM, AD, STAGING, failing];
    expect(all.filter((c) => shownConnection(c, { show: "failing" })).map((c) => c.id)).toEqual([
      "f",
    ]);
    expect(all.filter((c) => shownConnection(c, { show: "draft" })).map((c) => c.id)).toEqual([
      "st",
    ]);
  });

  it("names a server by its host", () => {
    expect(hostOf("ldaps://ldap.staging.qeet.in:636")).toBe("ldap.staging.qeet.in");
    expect(hostOf(null)).toBe("");
  });
});
