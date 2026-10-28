// The server's IP rule decision (internal/access/risk/ipallow: Decide, parsePrefix), in the
// browser. The server's check answers "allowed" for every address while enforcement is off, so
// the page judges an address against the stored rules itself until the server can say "would be
// refused" (a QTID gap); while enforcement is on the server's answer is used.

import type { IpAction } from "./api/ip-allowlist";

type Addr = { v6: boolean; value: bigint };
type Prefix = Addr & { bits: number };

function parseV4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    // Go's netip refuses leading zeros, signs and empty parts.
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

function parseV6(text: string): bigint | null {
  let rest = text;
  let tail: bigint | null = null;
  // An embedded IPv4 address at the end: "::ffff:192.0.2.1".
  const last = rest.lastIndexOf(":");
  if (rest.slice(last + 1).includes(".")) {
    tail = parseV4(rest.slice(last + 1));
    if (tail === null) return null;
    rest = `${rest.slice(0, last + 1)}0:0`;
  }
  const halves = rest.split("::");
  if (halves.length > 2) return null;
  const group = (s: string) => (s === "" ? [] : s.split(":"));
  const head = group(halves[0] ?? "");
  const end = halves.length === 2 ? group(halves[1] ?? "") : [];
  const missing = 8 - head.length - end.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...end];
  let value = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    value = (value << 16n) | BigInt(Number.parseInt(g, 16));
  }
  return tail === null ? value : ((value >> 32n) << 32n) | tail;
}

const MAPPED = 0xffffn << 32n;

/** An address, or null when it can't be read. An IPv4-mapped IPv6 address reads as IPv4. */
export function parseAddress(raw: string): Addr | null {
  const text = raw.trim().replace(/%.*$/, ""); // a zone is ignored, as Unmap().WithZone("") does
  if (!text) return null;
  if (!text.includes(":")) {
    const v4 = parseV4(text);
    return v4 === null ? null : { v6: false, value: v4 };
  }
  const v6 = parseV6(text);
  if (v6 === null) return null;
  if (v6 >> 32n === MAPPED >> 32n) return { v6: false, value: v6 & 0xffffffffn };
  return { v6: true, value: v6 };
}

/** A rule's range: a CIDR, or a bare address as a single-address range. */
export function parsePrefix(raw: string): Prefix | null {
  const text = raw.trim();
  const [addr = "", bitsText, extra] = text.split("/");
  if (extra !== undefined || addr.includes("%")) return null;
  const v6 = addr.includes(":");
  const parsed = v6 ? parseV6(addr) : parseV4(addr);
  if (parsed === null) return null;
  const width = v6 ? 128 : 32;
  if (bitsText === undefined) return { v6, value: parsed, bits: width };
  if (!/^(0|[1-9]\d{0,2})$/.test(bitsText)) return null;
  const bits = Number(bitsText);
  if (bits > width) return null;
  return { v6, value: parsed, bits };
}

function contains(prefix: Prefix, addr: Addr): boolean {
  if (prefix.v6 !== addr.v6) return false;
  const shift = BigInt((prefix.v6 ? 128 : 32) - prefix.bits);
  return prefix.value >> shift === addr.value >> shift;
}

/** How many addresses a range covers: 1 for a single address. */
export function rangeSize(cidr: string): bigint | null {
  const prefix = parsePrefix(cidr);
  if (!prefix) return null;
  return 1n << BigInt((prefix.v6 ? 128 : 32) - prefix.bits);
}

export type Decision =
  | { allowed: true }
  | { allowed: false; reason: "deny_rule"; cidr: string }
  | { allowed: false; reason: "not_in_allow_rules" | "address_unknown" };

/**
 * What the rules make of an address, as the server's Decide: an unreadable address is refused, a
 * matching deny rule refuses it, and once any allow rule exists it must match one.
 */
export function decide(rules: readonly { cidr: string; action: IpAction }[], ip: string): Decision {
  const addr = parseAddress(ip);
  if (!addr) return { allowed: false, reason: "address_unknown" };
  let hasAllow = false;
  let inAllow = false;
  for (const rule of rules) {
    const prefix = parsePrefix(rule.cidr);
    if (!prefix) continue;
    const match = contains(prefix, addr);
    if (rule.action === "deny" && match)
      return { allowed: false, reason: "deny_rule", cidr: rule.cidr };
    if (rule.action === "allow") {
      hasAllow = true;
      if (match) inAllow = true;
    }
  }
  if (hasAllow && !inAllow) return { allowed: false, reason: "not_in_allow_rules" };
  return { allowed: true };
}
