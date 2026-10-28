import { describe, expect, it } from "vitest";
import "@/i18n";

import { type ActivityEvent, changeTitle, kindOf } from "../api/authz-activity";
import { actorName, type ChangeContext, changeTarget } from "../components/audit/change-model";
import { fieldChanges, policyVersions, savesByMonth } from "../components/versions/versions-model";

const event = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: "e",
  type: "abac_policy.updated",
  category: "authorization",
  severity: "info",
  title: "",
  at: "2026-10-01T00:00:00Z",
  ...over,
});

const ctx: ChangeContext = {
  roleName: (id) => ({ "r-help": "Helpdesk" })[id],
  personName: (id) => ({ "u-priya": "Priya Nair", "u-sam": "Sam Lee" })[id],
  groupName: (id) => ({ "g-ops": "Operations" })[id],
  policyName: (id) => ({ "p-1": "Contractors: business hours only" })[id],
};

describe("authorization changes", () => {
  it("names every authorization action and its kind", () => {
    expect(changeTitle("role.group_assigned")).toBe("role_group_assigned");
    expect(changeTitle("user.created")).toBeNull();
    expect(kindOf("rebac.tuple_written")).toBe("relationships");
    expect(kindOf("role.assigned")).toBe("roles");
  });

  it("says what a change is on, from its metadata and the console's lists", () => {
    expect(
      changeTarget(
        event({
          type: "role.assigned",
          target: { type: "user", id: "u-sam" },
          metadata: { role_id: "r-help" },
        }),
        ctx,
      ),
    ).toEqual({
      role: "Helpdesk",
      label: "Sam Lee",
      mono: false,
      link: { to: "/users/$userId", params: { userId: "u-sam" } },
    });
    expect(
      changeTarget(
        event({
          type: "role.group_unassigned",
          target: { type: "group", id: "g-ops" },
          metadata: { role_id: "r-x" },
        }),
        ctx,
      ),
    ).toMatchObject({ role: "r-x", label: "Operations" });
    expect(
      changeTarget(
        event({
          type: "rebac.tuple_written",
          metadata: { object: "document:handbook", relation: "viewer", subject: "user:u-priya" },
        }),
        ctx,
      ).label,
    ).toBe("Priya Nair is viewer of document:handbook");
    expect(
      changeTarget(event({ type: "rebac.tuple_deleted", target: { id: "2ef389cf-aaaa" } }), ctx),
    ).toEqual({
      label: "2ef389cf",
      mono: true,
    });
    expect(changeTarget(event({ target: { id: "p-1" } }), ctx).label).toBe(
      "Contractors: business hours only",
    );
  });

  it("names who made it from the event, or the people list", () => {
    expect(actorName(event({ actor: { id: "u-priya", name: "Priya N." } }), ctx)).toBe("Priya N.");
    expect(actorName(event({ actor: { id: "u-sam" } }), ctx)).toBe("Sam Lee");
    expect(actorName(event({ actor: { type: "system" } }), ctx)).toBeUndefined();
  });
});

describe("policy versions", () => {
  const saves = [
    event({
      id: "a1",
      type: "abac_policy.created",
      at: "2026-07-01T00:00:00Z",
      target: { id: "p-1" },
      metadata: { name: "Contractors", effect: "deny", resource_type: "*", action: "*" },
    }),
    event({
      id: "a2",
      at: "2026-09-01T00:00:00Z",
      target: { id: "p-1" },
      metadata: { name: "Contractors", effect: "deny", resource_type: "ledger", action: "*" },
    }),
    event({
      id: "b1",
      type: "abac_policy.created",
      at: "2026-08-01T00:00:00Z",
      target: { id: "p-2" },
      metadata: { name: "Old rule" },
    }),
    event({
      id: "b2",
      type: "abac_policy.deleted",
      at: "2026-10-01T00:00:00Z",
      target: { id: "p-2" },
    }),
  ];
  const versions = policyVersions(saves, ctx.policyName);

  it("numbers each policy's saves from its first, newest first, the last current", () => {
    expect(versions.map((v) => [v.event.id, v.n, v.current, v.change])).toEqual([
      ["b2", 2, false, "deleted"],
      ["a2", 2, true, "changed"],
      ["b1", 1, false, "created"],
      ["a1", 1, false, "created"],
    ]);
    // The console's name for a live policy; the log's last name for a deleted one.
    expect(versions[1]?.policy).toBe("Contractors: business hours only");
    expect(versions[0]?.policy).toBe("Old rule");
  });

  it("compares the fields the log keeps with the version before", () => {
    expect(fieldChanges(versions[1] as (typeof versions)[number])).toEqual([
      { field: "resource_type", before: "*", after: "ledger" },
    ]);
  });

  it("counts saves by month, ending this month", () => {
    expect(savesByMonth(versions, Date.parse("2026-10-15T00:00:00Z"), 4)).toEqual([1, 1, 1, 1]);
  });
});
