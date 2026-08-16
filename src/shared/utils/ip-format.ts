// IP display formatting. Domain-independent — the single source for rendering
// client IPs across activity, timeline, and session views. Unwraps IPv4-mapped
// IPv6 (::ffff:), renders loopback/unroutable addresses as "localhost" (there is
// no real client IP in local dev), and missing IPs as an em dash.
const LOOPBACK_IPS = new Set(["::1", "127.0.0.1", "0.0.0.0", "localhost"]);

function unwrap(ip: string): string {
  return ip.trim().replace(/^::ffff:/i, "");
}

/** True for loopback / unroutable addresses that aren't a real client IP. */
export function isLoopbackIp(ip?: string | null): boolean {
  return !!ip && LOOPBACK_IPS.has(unwrap(ip));
}

/** Render an IP for display. */
export function formatIp(ip?: string | null): string {
  if (!ip) return "—";
  const v = unwrap(ip);
  return LOOPBACK_IPS.has(v) ? "localhost" : v;
}
