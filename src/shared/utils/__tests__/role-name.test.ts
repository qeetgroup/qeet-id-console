import { describe, expect, it } from "vitest";

import "@/i18n";
import { roleDescription, roleDisplayName } from "../role-name";

describe("role names", () => {
  it("words the four built-in roles, and leaves a custom role as it was named", () => {
    expect(["owner", "admin", "member", "viewer"].map(roleDisplayName)).toEqual([
      "Owner",
      "Admin",
      "Member",
      "Viewer",
    ]);
    expect(roleDisplayName("Helpdesk")).toBe("Helpdesk");
    // Only the server's exact names: "constructor" or "Owner" are a custom role's own.
    expect(roleDisplayName("constructor")).toBe("constructor");
    expect(roleDisplayName("Owner")).toBe("Owner");
  });

  it("describes a built-in role from the catalogue, never the server's English", () => {
    expect(roleDescription({ name: "admin", description: "Administrator — everything but…" })).toBe(
      "Everything but deleting the organisation",
    );
    expect(roleDescription({ name: "Helpdesk", description: "Resets passwords" })).toBe(
      "Resets passwords",
    );
    expect(roleDescription({ name: "Helpdesk", description: null })).toBe("");
  });
});
