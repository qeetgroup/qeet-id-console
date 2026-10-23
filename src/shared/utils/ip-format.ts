// Unwraps IPv4-mapped IPv6 (::ffff:) and shows loopback as "localhost", since local dev has no
// real client IP.
const LOOPBACK_IPS = new Set(["::1", "127.0.0.1", "0.0.0.0", "localhost"]);

function unwrap(ip: string): string {
  return ip.trim().replace(/^::ffff:/i, "");
}

/** Returns true for a loopback or unroutable address, which isn't a real client IP. */
export function isLoopbackIp(ip?: string | null): boolean {
  return !!ip && LOOPBACK_IPS.has(unwrap(ip));
}

export function formatIp(ip?: string | null): string {
  if (!ip) return "—";
  const v = unwrap(ip);
  return LOOPBACK_IPS.has(v) ? "localhost" : v;
}
