import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/platform/errors/error-codes";
import { userMessageForCode } from "@/platform/errors/user-message";

// An address-rule refusal is a network the organisation refuses, not a missing
// permission, and a refused rule change is a lockout averted, not a fault.
describe("address rule messages", () => {
  it("names the network, not access, for a refused sign-in", () => {
    expect(userMessageForCode(ERROR_CODES.ADDRESS_NOT_ALLOWED, "authz")).toBe(
      "Your organisation doesn't allow sign-in from this network. Contact your administrator.",
    );
  });

  it("explains a rule change refused because it would lock the admin out", () => {
    expect(userMessageForCode(ERROR_CODES.RULES_LOCK_OUT_CALLER, "api")).toMatch(/lock you out/);
  });
});
