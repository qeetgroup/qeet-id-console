import { describe, expect, it } from "vitest";

import type { Invitation } from "../api/invitations";
import {
  canInviteAgain,
  canResend,
  canRevoke,
  daysLeft,
  invitationsSearch,
  joinDays,
  matchesInvite,
  median,
  sentByMonth,
} from "../invitations-model";
import { DAY_MS } from "../people-model";

const NOW = Date.parse("2026-10-27T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

function invite(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: "i1",
    tenant_id: "t1",
    email: "kavya@qeet.in",
    role_id: "role-member",
    status: "pending",
    expires_at: ago(-10),
    accepted_at: null,
    created_at: ago(4),
    ...overrides,
  };
}

describe("joinDays, daysLeft and median", () => {
  it("measures the time from the email to joining, and what's left on a link", () => {
    expect(joinDays(invite({ created_at: ago(5), accepted_at: ago(3.5) }))).toBeCloseTo(1.5);
    expect(joinDays(invite())).toBeNull();
    expect(daysLeft(invite({ expires_at: ago(-9.2) }), NOW)).toBe(10);
    expect(daysLeft(invite({ expires_at: ago(2) }), NOW)).toBeLessThan(0);
  });

  it("takes the middle value, or the mean of the middle two", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("sentByMonth", () => {
  it("counts the invitations sent in each month, ending with this one", () => {
    const months = sentByMonth(
      [
        invite({ created_at: "2026-10-03T00:00:00Z" }),
        invite({ created_at: "2026-10-20T00:00:00Z" }),
        invite({ created_at: "2026-09-15T00:00:00Z" }),
      ],
      NOW,
      3,
    );
    expect(months).toEqual([0, 1, 2]);
  });
});

describe("matchesInvite", () => {
  it("narrows by status, role, when it was sent and the email", () => {
    const i = invite({ created_at: ago(10) });
    expect(matchesInvite(i, {}, NOW)).toBe(true);
    expect(matchesInvite(i, { status: "accepted" }, NOW)).toBe(false);
    expect(matchesInvite(i, { role: "role-admin" }, NOW)).toBe(false);
    expect(matchesInvite(i, { sent: "7" }, NOW)).toBe(false);
    expect(matchesInvite(i, { sent: "30" }, NOW)).toBe(true);
    expect(matchesInvite(i, { sent: "older" }, NOW)).toBe(false);
    expect(matchesInvite(invite({ created_at: ago(45) }), { sent: "older" }, NOW)).toBe(true);
    expect(matchesInvite(i, { q: "KAVYA" }, NOW)).toBe(true);
    expect(matchesInvite(i, { q: "sowmya" }, NOW)).toBe(false);
  });
});

describe("what an invitation allows", () => {
  it("resends pending and expired ones, revokes pending ones, and invites afresh after a revoke", () => {
    expect([canResend(invite()), canRevoke(invite()), canInviteAgain(invite())]).toEqual([
      true,
      true,
      false,
    ]);
    expect([
      canResend(invite({ status: "expired" })),
      canRevoke(invite({ status: "expired" })),
    ]).toEqual([true, false]);
    expect([
      canResend(invite({ status: "revoked" })),
      canInviteAgain(invite({ status: "revoked" })),
    ]).toEqual([false, true]);
    expect([
      canResend(invite({ status: "accepted" })),
      canRevoke(invite({ status: "accepted" })),
    ]).toEqual([false, false]);
  });
});

describe("invitationsSearch", () => {
  it("keeps known filters and drops unknown values", () => {
    expect(
      invitationsSearch.parse({ status: "pending", sent: "365", role: "role-dev", q: " " }),
    ).toEqual({
      status: "pending",
      role: "role-dev",
    });
  });
});
