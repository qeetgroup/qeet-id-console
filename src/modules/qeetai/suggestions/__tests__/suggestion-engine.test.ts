import { describe, expect, it } from "vitest";

import type { ConsoleContext } from "../../context/types/context.types";
import { rankSuggestions } from "../suggestion-engine";

function on(pathname: string, selection?: ConsoleContext["selection"]): ConsoleContext {
  return {
    route: { pathname, title: pathname },
    tenantId: "tenant-a",
    userId: "operator-1",
    capabilities: [],
    selection,
  };
}

function labels(ctx: ConsoleContext): string[] {
  return rankSuggestions(ctx, () => true).map((s) => s.label);
}

describe("route suggestions while the assistant only reads", () => {
  it("offers no change tool on the users list", () => {
    expect(labels(on("/users"))).toEqual([
      "Search users",
      "Show suspended users",
      "Summarize user activity",
    ]);
  });

  it("offers no change tool on a selected user", () => {
    const shown = labels(on("/users/$userId", { kind: "user", id: "user-7" }));
    expect(shown).not.toContain("Disable this user");
    expect(shown).not.toContain("Reset MFA");
    expect(shown).toContain("View active sessions");
  });

  it("offers nothing to rotate on the signing keys page", () => {
    expect(labels(on("/settings/signing-keys"))).toEqual([]);
  });
});
