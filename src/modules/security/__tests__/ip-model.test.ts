import { describe, expect, it } from "vitest";

import { decide, parseAddress, parsePrefix, rangeSize } from "../ip-model";

// The server's ipallow.Decide and parsePrefix, which these mirror for the page's address check.
describe("IP rules in the browser", () => {
  it("reads addresses and ranges as Go's netip does", () => {
    expect(parseAddress("203.0.113.7")).toEqual({ v6: false, value: 0xcb007107n });
    expect(parseAddress("::ffff:203.0.113.7")).toEqual({ v6: false, value: 0xcb007107n });
    expect(parseAddress("2001:db8::1")?.v6).toBe(true);
    for (const bad of ["", "1.2.3", "1.2.3.256", "01.2.3.4", "2001:db8:::1", "hello"]) {
      expect(parseAddress(bad)).toBeNull();
    }
    expect(parsePrefix("203.0.113.0/24")).toMatchObject({ bits: 24 });
    expect(parsePrefix("203.0.113.9")).toMatchObject({ bits: 32 });
    expect(parsePrefix("2001:db8::/32")).toMatchObject({ v6: true, bits: 32 });
    for (const bad of ["203.0.113.0/33", "203.0.113.0/", "10.0.0.0/8/8", "fe80::1%eth0/64"]) {
      expect(parsePrefix(bad)).toBeNull();
    }
  });

  it("counts the addresses a range covers", () => {
    expect(rangeSize("192.0.2.244/30")).toBe(4n);
    expect(rangeSize("192.0.2.10")).toBe(1n);
    expect(rangeSize("2001:db8::/64")).toBe(2n ** 64n);
  });

  it("lets a deny rule win, and once an allow rule exists, needs a match", () => {
    const rules = [
      { cidr: "203.0.113.0/24", action: "allow" as const },
      { cidr: "203.0.113.66", action: "deny" as const },
    ];
    expect(decide(rules, "203.0.113.10")).toEqual({ allowed: true });
    expect(decide(rules, "203.0.113.66")).toEqual({
      allowed: false,
      reason: "deny_rule",
      cidr: "203.0.113.66",
    });
    expect(decide(rules, "198.51.100.4")).toEqual({ allowed: false, reason: "not_in_allow_rules" });
    expect(decide([{ cidr: "198.51.100.0/24", action: "deny" }], "203.0.113.10")).toEqual({
      allowed: true,
    });
  });

  it("refuses an address it can't read, and an IPv6 address outside IPv4 rules", () => {
    expect(decide([], "not-an-ip")).toEqual({ allowed: false, reason: "address_unknown" });
    expect(decide([{ cidr: "203.0.113.0/24", action: "allow" }], "2001:db8::1")).toEqual({
      allowed: false,
      reason: "not_in_allow_rules",
    });
  });
});
