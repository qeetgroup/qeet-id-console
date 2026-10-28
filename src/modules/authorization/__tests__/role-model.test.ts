import { describe, expect, it } from "vitest";

import type { Permission, Role } from "../api/rbac";
import { isUnconditional } from "../authz-posture";
import { matchesRole, roleLook, sortRoles } from "../components/roles/roles-model";
import {
  actionsOf,
  holdersByPermission,
  isOwnerRole,
  permissionsByPerson,
  reachOf,
  resourcesOf,
  roleAccess,
  shortList,
  splitPermission,
  spreadOf,
} from "../role-model";

const perm = (key: string): Permission => ({ id: `p-${key}`, key, description: "" });
const role = (id: string, name: string, over: Partial<Role> = {}): Role => ({
  id,
  tenant_id: "t",
  name,
  description: "",
  is_system: false,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

const CATALOGUE = ["user.read", "user.write", "role.read", "branding.write"].map(perm);
const owner = role("r-owner", "owner", { is_system: true });
const admin = role("r-admin", "Admin");
const helpdesk = role("r-help", "Helpdesk");
const unused = role("r-none", "Unused");

const access = roleAccess({
  roles: [owner, admin, helpdesk, unused],
  rolePermissions: new Map([
    ["r-owner", CATALOGUE.map((p) => p.key)],
    ["r-admin", CATALOGUE.map((p) => p.key)],
    ["r-help", ["user.read", "user.write"]],
    ["r-none", []],
  ]),
  // A person's own roles, by name, as the people list gives them (any case).
  people: [
    { id: "u-priya", roles: ["owner"] },
    { id: "u-aarav", roles: ["admin"] },
    { id: "u-riya", roles: [] },
    { id: "u-sam", roles: [] },
  ],
  groups: [
    { id: "g-support", name: "Support" },
    { id: "g-empty", name: "Empty" },
  ],
  groupRoles: new Map([
    ["g-support", ["r-help"]],
    ["g-empty", ["r-help"]],
  ]),
  members: new Map([
    ["g-support", ["u-riya", "u-aarav"]],
    ["g-empty", []],
  ]),
});
const of = (id: string) => access.find((a) => a.role.id === id);

describe("permission keys", () => {
  it("reads a key as the server does, at its last dot", () => {
    expect(splitPermission("user.read")).toEqual({ resource: "user", action: "read" });
    expect(splitPermission("vault.secret.read")).toEqual({
      resource: "vault.secret",
      action: "read",
    });
    expect(splitPermission("audit")).toEqual({ resource: "", action: "audit" });
  });

  it("groups the catalogue by resource, A to Z, with read and write first among actions", () => {
    const resources = resourcesOf([...CATALOGUE, perm("user.approve")]);
    expect(resources.map((r) => r.key)).toEqual(["branding", "role", "user"]);
    expect(actionsOf(resources)).toEqual(["read", "write", "approve"]);
  });
});

describe("roleAccess", () => {
  it("counts people who hold a role directly and through a group's members", () => {
    expect([...(of("r-admin")?.holders ?? [])]).toEqual(["u-aarav"]);
    const help = of("r-help");
    expect(help?.direct).toEqual([]);
    expect([...(help?.holders ?? [])].sort()).toEqual(["u-aarav", "u-riya"]);
    expect(help?.throughGroupsOnly).toBe(2);
    expect(help?.groups.map((g) => g.name)).toEqual(["Support", "Empty"]);
  });

  it("knows the owner role only by its built-in flag and name", () => {
    expect(isOwnerRole(owner)).toBe(true);
    expect(isOwnerRole(role("x", "owner"))).toBe(false);
  });

  it("works out what each person can do, and how far that reaches", () => {
    const held = permissionsByPerson(access);
    expect(reachOf(held.get("u-priya"), CATALOGUE.length)).toBe("every");
    expect(reachOf(held.get("u-riya"), CATALOGUE.length)).toBe("changes");
    expect(reachOf(new Set(["role.read"]), CATALOGUE.length)).toBe("reads");
    expect(reachOf(held.get("u-sam"), CATALOGUE.length)).toBe("none");
  });

  it("says how widely each permission is held", () => {
    const holders = holdersByPermission(access);
    expect(holders.get("user.read")?.size).toBe(3);
    expect(spreadOf("user.read", access, holders.get("user.read"), 4)).toBe("most");
    expect(spreadOf("role.read", access, holders.get("role.read"), 2)).toBe("everyone");
    expect(spreadOf("branding.write", access, holders.get("branding.write"), 40)).toBe("some");
    const ownerOnly = roleAccess({
      roles: [owner],
      rolePermissions: new Map([["r-owner", ["gdpr.write"]]]),
    });
    expect(spreadOf("gdpr.write", ownerOnly, new Set(["u-priya"]), 4)).toBe("owners");
  });
});

describe("the Roles list's filters", () => {
  it("finds roles no one holds, that grant everything (not the owner) or nothing", () => {
    const n = CATALOGUE.length;
    expect(access.filter((a) => roleLook(a, "unused", n)).map((a) => a.role.name)).toEqual([
      "Unused",
    ]);
    expect(access.filter((a) => roleLook(a, "every", n)).map((a) => a.role.name)).toEqual([
      "Admin",
    ]);
    expect(access.filter((a) => roleLook(a, "empty", n)).map((a) => a.role.name)).toEqual([
      "Unused",
    ]);
  });

  it("searches name and description, and filters by type", () => {
    const n = CATALOGUE.length;
    expect(access.filter((a) => matchesRole(a, { q: "help" }, n)).map((a) => a.role.id)).toEqual([
      "r-help",
    ]);
    expect(
      access.filter((a) => matchesRole(a, { type: "builtin" }, n)).map((a) => a.role.id),
    ).toEqual(["r-owner"]);
  });

  it("sorts most held first, then by name", () => {
    expect(sortRoles(access, null).map((a) => a.role.name)).toEqual([
      "Helpdesk",
      "Admin",
      "owner",
      "Unused",
    ]);
    expect(
      sortRoles(access, { column: "name", direction: "ascending" }).map((a) => a.role.name),
    ).toEqual(["Admin", "Helpdesk", "owner", "Unused"]);
  });
});

describe("shortList", () => {
  const words = { and: "and", more: (n: number) => `${n} more` };
  it("joins a few names, and counts the rest", () => {
    expect(shortList(["Admin"], words)).toBe("Admin");
    expect(shortList(["Admin", "owner"], words)).toBe("Admin and owner");
    expect(shortList(["A", "B", "C", "D", "E"], words)).toBe("A, B, C and 2 more");
  });
});

describe("isUnconditional", () => {
  it("treats no condition, {} and an empty all as always matching, as the server does", () => {
    expect(isUnconditional(null)).toBe(true);
    expect(isUnconditional({})).toBe(true);
    expect(isUnconditional({ all: [] })).toBe(true);
    expect(isUnconditional({ attr: "subject.dept", op: "eq", value: "eng" })).toBe(false);
  });
});
