// Small presentational helpers for the activity feed.

const LOOPBACK_IPS = new Set(["::1", "127.0.0.1", "0.0.0.0", "::ffff:127.0.0.1", "localhost"]);

/** True for loopback / unroutable addresses that aren't a real client IP. */
export function isLoopbackIp(ip?: string | null): boolean {
  return !!ip && LOOPBACK_IPS.has(ip.trim());
}

/**
 * Renders an IP for display. Real client IPs show verbatim; loopback addresses
 * (local dev, where there is no real client IP) render as "localhost" instead of
 * a confusing "::1"; missing IPs render as an em dash.
 */
export function formatIp(ip?: string | null): string {
  if (!ip) return "—";
  if (isLoopbackIp(ip)) return "localhost";
  return ip;
}
