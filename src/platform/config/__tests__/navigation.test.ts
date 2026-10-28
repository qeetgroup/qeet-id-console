import { describe, expect, it } from "vitest";

import {
  filterNavigation,
  findNavGroupForPath,
  getNavGroups,
  lookupNavTitle,
  safeNavigation,
  translateNavigation,
} from "../navigation";
import { isNavBranchActive, isNavPathActive, type NavTreeItem } from "../navigation-state";

// The navigation as the sidebar shows it.
const navGroups = translateNavigation(getNavGroups());

const users: NavTreeItem = {
  url: "/users",
  items: [{ url: "/users" }, { url: "/users/sessions" }],
};

describe("console navigation state", () => {
  it("translates every label, title and description, and keeps group ids unique", () => {
    const copy = navGroups.flatMap((group) => [
      group.label,
      ...group.items.flatMap((item) => [
        item.title,
        item.description ?? "",
        ...(item.items?.map((sub) => sub.title) ?? []),
      ]),
    ]);
    expect(copy.filter((text) => text.startsWith("nav:"))).toEqual([]);
    expect(new Set(navGroups.map((group) => group.id)).size).toBe(navGroups.length);
  });

  it("keeps Directory focused on people, groups, organisations and sync", () => {
    const directory = navGroups.find((group) => group.id === "directory");

    expect(directory?.items.map((item) => item.title)).toEqual([
      "Users",
      "Groups",
      "Organisations",
      "Directories",
    ]);
  });

  it("has one overview, the Dashboard: each area opens on its main page", () => {
    const overviews = navGroups
      .filter((group) => group.id !== "overview")
      .flatMap((group) => group.items.flatMap((item) => [item, ...(item.items ?? [])]))
      .filter((item) => item.title === "Overview");
    expect(overviews).toEqual([]);
  });

  it("opens SSO on the one list of SAML, with no separate Connections entry", () => {
    // LDAP and SCIM have their one home in Directories › Connections.
    const authentication = navGroups.find((group) => group.id === "authentication");
    expect(authentication?.items.map((item) => item.url)).not.toContain("/auth/connections");
    expect(
      authentication?.items
        .find((item) => item.url === "/auth/connections/saml")
        ?.items?.map((item) => item.url),
    ).toEqual(["/auth/connections/saml", "/auth/connections/saml-idp"]);
  });

  it("exposes the completed Directory views with short labels and scoped access", () => {
    const directory = navGroups.find((group) => group.id === "directory");
    const users = directory?.items.find((item) => item.title === "Users");
    const directories = directory?.items.find((item) => item.title === "Directories");

    // Suspended is a filter on All users, not a sub-page.
    expect(users?.items?.map((item) => item.title)).toEqual([
      "All users",
      "Invitations",
      "Deleted",
    ]);
    // SCIM and LDAP are connections, opened from Connections, not tabs of their own.
    expect(directories?.items?.map((item) => item.title)).toEqual([
      "Connections",
      "Sync activity",
      "Sync errors",
      "Mappings",
    ]);
    for (const item of directories?.items ?? []) {
      expect(item.title.length).toBeLessThanOrEqual(13);
      expect(item.requiredPermission).toBe("connection.read");
      expect(findNavGroupForPath(navGroups, item.url)).toBe("directory");
      expect(item.planned).toBeUndefined();
    }
  });

  it("marks leaf routes only on exact matches", () => {
    expect(isNavPathActive("/security", "/security")).toBe(true);
    expect(isNavPathActive("/security/audit-logs", "/security")).toBe(false);
    expect(isNavPathActive("/", "/")).toBe(true);
  });

  it("keeps a navigation branch active on child and detail routes", () => {
    expect(isNavBranchActive("/users", users)).toBe(true);
    expect(isNavBranchActive("/users/sessions", users)).toBe(true);
    expect(isNavBranchActive("/users/4c1f", users)).toBe(true);
    expect(isNavBranchActive("/groups", users)).toBe(false);
  });

  it("removes denied destinations while retaining a branch with an allowed child", () => {
    const visible = filterNavigation(
      navGroups,
      (permission) => permission === undefined || permission === "policy.read",
    );
    const authorization = visible.find((group) => group.id === "authorization");
    const models = authorization?.items.find((item) => item.title === "Models");

    expect(models?.items?.map((item) => item.title)).toEqual(["ABAC"]);
    expect(
      visible.find((group) => group.id === "overview")?.items.map((item) => item.title),
    ).toEqual(["Dashboard"]);
  });

  it("resolves the rail's active group by longest matching destination", () => {
    expect(findNavGroupForPath(navGroups, "/")).toBe("overview");
    expect(findNavGroupForPath(navGroups, "/authorization/roles/42")).toBe("authorization");
    expect(findNavGroupForPath(navGroups, "/security/audit-logs")).toBe("security");
    // SCIM lives under Directory › Connections, and its old address isn't a page any more.
    expect(findNavGroupForPath(navGroups, "/directory/connections/scim")).toBe("directory");
    // A SAML connection's page sits under Authentication › SSO.
    expect(findNavGroupForPath(navGroups, "/auth/connections/saml/abc")).toBe("authentication");
    expect(findNavGroupForPath(navGroups, "/unmapped-route")).toBeUndefined();
  });

  it("limits unresolved access navigation to overview and organization selection", () => {
    const visiblePaths = safeNavigation(navGroups).flatMap((group) =>
      group.items.flatMap((item) => [item.url, ...(item.items?.map((child) => child.url) ?? [])]),
    );

    expect(new Set(visiblePaths)).toEqual(new Set(["/", "/organizations"]));
  });
});

describe("page titles", () => {
  it("names a detail page by its section, never by the id in its address", () => {
    const meta = lookupNavTitle("/users/6c9d2a7e-1f3b-4c8d-9e0a-1234567890ab", navGroups);
    expect(meta.parent?.url).toBe("/users");
    expect(meta.title).toBe("Details");
  });

  it("titles an unlisted page from its address, under its section", () => {
    const meta = lookupNavTitle("/users/some-report", navGroups);
    expect(meta.parent?.url).toBe("/users");
    expect(meta.title).toBe("Some Report");
  });

  it("keeps the title of a page with its own entry", () => {
    const meta = lookupNavTitle("/users", navGroups);
    expect(meta.parent).toBeUndefined();
    expect(meta.title).not.toBe("Details");
  });
});
