import { describe, expect, it } from "vitest";

import { groupPermissionsByResource, type Permission, wildcardPermissions } from "../api/rbac";

function perm(key: string): Permission {
  return { id: key, key, description: "" };
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
