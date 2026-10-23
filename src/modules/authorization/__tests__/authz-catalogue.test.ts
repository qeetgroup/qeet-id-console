import { describe, expect, it } from "vitest";

import i18n from "@/i18n";

import {
  AUTHZ_RESOURCE_TYPES,
  type AuditEvent,
  isAuthzAction,
  isAuthzEvent,
  resourceTypeKey,
  toVersionTimeline,
} from "../api/audit";
import { groupPermissionsByResource, type Permission, wildcardPermissions } from "../api/rbac";

function perm(key: string): Permission {
  return { id: key, key, description: "" };
}

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "e1",
    tenant_id: "t",
    actor_user_id: "u1",
    actor_type: "user",
    action: "role.updated",
    resource_type: "role",
    resource_id: "r1",
    ip: null,
    user_agent: null,
    request_id: null,
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupPermissionsByResource", () => {
  it("buckets permissions by the segment before the first dot, keeping catalogue order", () => {
    const groups = groupPermissionsByResource([
      perm("users.read"),
      perm("roles.write"),
      perm("users.write"),
      perm("users.mfa.reset"),
      perm("billing"),
    ]);
    expect([...groups.keys()]).toEqual(["users", "roles", "billing"]);
    expect(groups.get("users")?.map((p) => p.key)).toEqual([
      "users.read",
      "users.write",
      "users.mfa.reset",
    ]);
    expect(groups.get("billing")?.map((p) => p.key)).toEqual(["billing"]);
  });

  it("returns an empty map for an empty catalogue", () => {
    expect(groupPermissionsByResource([]).size).toBe(0);
  });
});

describe("wildcardPermissions", () => {
  it("flags any key containing a wildcard, wherever it appears", () => {
    expect(
      wildcardPermissions([
        perm("users.read"),
        perm("users.*"),
        perm("*"),
        perm("*.read"),
        perm("roles.write"),
      ]).map((p) => p.key),
    ).toEqual(["users.*", "*", "*.read"]);
  });
});

describe("isAuthzAction", () => {
  it.each([
    "abac.evaluated",
    "abac_policy.created",
    "rbac_policy.deleted",
    "role.updated",
    "role_binding.created",
    "permission.revoked",
    "relation.created",
    "relation_tuple.deleted",
    "rebac.tuple_written",
    "policy.updated",
    "group_role.assigned",
    "group_role.unassigned",
    "security_policy.updated",
    "ROLE.CREATED",
  ])("treats %s as an authorization action", (action) => {
    expect(isAuthzAction(action)).toBe(true);
  });

  it.each([
    "user.created",
    "roles.updated",
    "role",
    "permissions",
    "session.revoked",
    "group.created",
    "security.alert",
    "",
  ])("does not treat %j as an authorization action", (action) => {
    expect(isAuthzAction(action)).toBe(false);
  });
});

describe("resourceTypeKey", () => {
  it("labels every authorization resource type, and nothing else", () => {
    for (const type of AUTHZ_RESOURCE_TYPES) {
      const key = resourceTypeKey(type);
      expect(key && i18n.exists(key, { lng: "en" })).toBe(true);
    }
    for (const type of ["user", "constructor", "toString", ""]) {
      expect(resourceTypeKey(type)).toBeNull();
    }
  });
});

describe("isAuthzEvent", () => {
  it("matches on an authorization resource type even when the action prefix does not", () => {
    expect(AUTHZ_RESOURCE_TYPES).toContain("group_role");
    expect(
      isAuthzEvent(event({ action: "group_role.assigned", resource_type: "group_role" })),
    ).toBe(true);
    expect(
      isAuthzEvent(event({ action: "security_policy.updated", resource_type: "security_policy" })),
    ).toBe(true);
  });

  it("matches on the action prefix when the resource type is unrelated", () => {
    expect(isAuthzEvent(event({ action: "role.assigned", resource_type: "user" }))).toBe(true);
    expect(isAuthzEvent(event({ action: "group_role.assigned", resource_type: "group" }))).toBe(
      true,
    );
    expect(
      isAuthzEvent(event({ action: "security_policy.updated", resource_type: "tenant" })),
    ).toBe(true);
  });

  it("rejects events that are authorization-related by neither", () => {
    expect(isAuthzEvent(event({ action: "user.created", resource_type: "user" }))).toBe(false);
  });
});

describe("toVersionTimeline", () => {
  it("keeps only the resource's events, newest first", () => {
    const timeline = toVersionTimeline(
      [
        event({ id: "old", created_at: "2026-10-01T00:00:00Z", action: "role.created" }),
        event({ id: "other", resource_id: "r2", created_at: "2026-10-05T00:00:00Z" }),
        event({ id: "new", created_at: "2026-10-03T00:00:00Z", metadata: { name: "Admin" } }),
        event({ id: "mid", created_at: "2026-10-02T00:00:00Z" }),
      ],
      "r1",
    );
    expect(timeline.map((v) => v.id)).toEqual(["new", "mid", "old"]);
    expect(timeline[0]).toEqual({
      id: "new",
      action: "role.updated",
      actor: "u1",
      at: "2026-10-03T00:00:00Z",
      metadata: { name: "Admin" },
    });
    expect(timeline[2]?.action).toBe("role.created");
  });

  it("attributes actorless events to the actor type", () => {
    const [entry] = toVersionTimeline(
      [event({ actor_user_id: null, actor_type: "api_key" })],
      "r1",
    );
    expect(entry?.actor).toBe("api_key");
  });

  it("returns nothing for a resource with no history", () => {
    expect(toVersionTimeline([event()], "missing")).toEqual([]);
  });
});
