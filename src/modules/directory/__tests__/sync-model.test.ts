import { describe, expect, it } from "vitest";

import { causeOf, connectionName, portOf, problemsOf, reach, runKey } from "../sync-model";
import { ago, check, push } from "./fixtures";

const DAY = 86_400_000;

describe("Sync errors › causes", () => {
  it("names a cause from the connection's kind, the run and the server's status", () => {
    expect(causeOf(check())).toBe("unreachable");
    expect(causeOf(check({ operation: "sign-in", http_status: 401 }))).toBe("signInRefused");
    expect(causeOf(push({ http_status: 409 }))).toBe("exists");
    expect(causeOf(push({ http_status: 404 }))).toBe("notFound");
    expect(causeOf(push({ http_status: 400 }))).toBe("refusedData");
    expect(causeOf(push({ http_status: 429 }))).toBe("tooMany");
    expect(causeOf(push({ http_status: 403 }))).toBe("denied");
    expect(causeOf(push({ http_status: 500 }))).toBe("failedHere");
  });

  it("makes one problem of a cause on a connection, newest failure first, critical first", () => {
    const problems = problemsOf([
      check({ id: "old", started_at: ago(20 * DAY) }),
      push({
        id: "dup",
        status: "failed",
        http_status: 409,
        severity: "warning",
        started_at: ago(DAY),
      }),
      check({ id: "new", started_at: ago(6 * DAY) }),
      check({ id: "closed", resolution: "resolved" }),
    ]);
    expect(problems.map((p) => [p.cause, p.events.map((e) => e.id)])).toEqual([
      ["unreachable", ["new", "old"]],
      ["exists", ["dup"]],
    ]);
    expect(problems[0]?.critical).toBe(true);
    expect(problems[0]?.retryable.map((e) => e.id)).toEqual(["new", "old"]);
    expect(problems[1]?.retryable).toEqual([]);
  });

  it("counts the people a problem reached, named or new, and its groups", () => {
    expect(
      reach([
        push({ resource_id: "u1" }),
        push({ resource_id: "u1" }),
        push({ resource_id: "" }),
        push({ resource_type: "group", resource_id: "g1" }),
      ]),
    ).toEqual({ people: 1, unnamed: 1, groups: 1 });
  });
});

describe("Sync activity › runs", () => {
  it("names a run in words", () => {
    expect(runKey(check())).toBe("activity.run.test");
    expect(runKey(check({ operation: "sign-in" }))).toBe("activity.run.signIn");
    expect(runKey(push())).toBe("activity.run.user.post");
    expect(runKey(push({ resource_type: "group", operation: "patch" }))).toBe(
      "activity.run.group.patch",
    );
    expect(runKey(push({ operation: "options" }))).toBe("activity.run.other");
  });

  it("names a removed connection, and the port an address uses", () => {
    const names = { scim: "SCIM provisioning", removed: "Removed connection" };
    expect(connectionName([], "gone", names)).toBe("Removed connection");
    expect(portOf("ldaps://ldap.staging.qeet.in:636")).toBe("636");
    expect(portOf("ldaps://ad.example")).toBe("636");
    expect(portOf("ldap://ad.example")).toBe("389");
    expect(portOf(null)).toBe("");
  });
});
