import { describe, expect, it } from "vitest";

import { checkAddresses, isEmail, parseAddresses, sendable, toE164 } from "../add-people-model";
import type { Invitation } from "../api/invitations";
import type { User } from "../api/users";

const member = {
  id: "u1",
  tenant_id: "t1",
  email: "Priya@qeet.in",
  status: "active",
  created_at: "2025-01-01T00:00:00Z",
} as User;
const pending = {
  id: "i1",
  tenant_id: "t1",
  email: "sai.sharma@qeet.in",
  status: "pending",
  expires_at: "",
  created_at: "",
} as Invitation;
const revoked = { ...pending, id: "i2", email: "imran@qeet.in", status: "revoked" } as Invitation;

describe("parseAddresses", () => {
  it("splits on lines, commas, semicolons and spaces, once per address", () => {
    expect(parseAddresses("a@x.in, b@x.in\n<c@x.in>; A@X.in  ")).toEqual([
      "a@x.in",
      "b@x.in",
      "c@x.in",
    ]);
    expect(parseAddresses("  \n ")).toEqual([]);
  });
});

describe("checkAddresses", () => {
  it("names what happens to each: new, sent again, skipped as a member, or not an address", () => {
    const checks = checkAddresses(
      ["kavya@qeet.in", "SAI.SHARMA@qeet.in", "priya@qeet.in", "imran@qeet.in", "nope"],
      [member],
      [pending, revoked],
    );
    expect(checks.map((c) => c.kind)).toEqual(["new", "invited", "member", "new", "invalid"]);
    expect(sendable(checks).map((c) => c.email)).toEqual([
      "kavya@qeet.in",
      "SAI.SHARMA@qeet.in",
      "imran@qeet.in",
    ]);
  });
});

describe("isEmail and toE164", () => {
  it("accepts an address, and a phone number only with its country code", () => {
    expect(isEmail(" kavya@qeet.in ")).toBe(true);
    expect(isEmail("kavya@qeet")).toBe(false);
    expect(toE164("+91 98765 43210")).toBe("+919876543210");
    expect(toE164("+1 (555) 555-0100")).toBe("+15555550100");
    expect(toE164("98765 43210")).toBeNull();
  });
});
