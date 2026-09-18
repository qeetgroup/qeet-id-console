import { describe, expect, it } from "vitest";

import { toPublicSession } from "../server-session";

function unsignedJwt(payload: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

describe("public server session", () => {
  it("returns only non-secret session metadata", () => {
    const session = toPublicSession({
      accessToken: unsignedJwt({ sub: "target-1" }),
      refreshToken: "refresh-secret",
      expiresAt: "2030-01-01T00:00:00Z",
      sessionId: "session-1",
      userId: "user-1",
      tenantId: "tenant-1",
    });

    expect(session).toEqual({
      isAuthenticated: true,
      expiresAt: "2030-01-01T00:00:00Z",
      sessionId: "session-1",
      userId: "user-1",
      tenantId: "tenant-1",
      version: 0,
      organizationSelectionRequired: false,
      impersonationActor: null,
    });
    expect(session).not.toHaveProperty("accessToken");
    expect(session).not.toHaveProperty("refreshToken");
  });

  it("derives safe impersonation metadata on the server", () => {
    const session = toPublicSession({
      accessToken: unsignedJwt({
        sub: "target-1",
        act: { sub: "admin-1", email: "admin@example.com", display_name: "Admin" },
      }),
      refreshToken: "refresh-secret",
      userId: "target-1",
    });

    expect(session.impersonationActor).toEqual({
      targetSubject: "target-1",
      actorSubject: "admin-1",
      actorEmail: "admin@example.com",
      actorDisplayName: "Admin",
    });
  });

  it("exposes only the organization-selection decision, never the credentials", () => {
    const session = toPublicSession({
      accessToken: "secret",
      refreshToken: "secret",
      userId: "user-1",
      organizationSelectionRequired: true,
    });
    expect(session.organizationSelectionRequired).toBe(true);
    expect(session).not.toHaveProperty("accessToken");
    expect(session).not.toHaveProperty("refreshToken");
  });
});
