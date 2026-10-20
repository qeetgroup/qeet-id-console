// The console's server calls the API on the person's behalf, so the API sees
// the console's own address for everyone. A trusted relay may name the
// person's address (server QTID-828): it sends the relay key the API is
// configured with (RELAY_KEYS there, QEET_ID_RELAY_KEY here) and the address
// it derived, and the API's rate limits, sign-in lockout, address rules,
// sessions and audit then use the person's address. Without the key the API
// ignores the claim, so nothing here can be forged from a browser.
//
// Server-only: the key never reaches the browser.

// A bare IPv4 or IPv6 address. No node: import: this module is bundled for the
// browser too (server-proxy.ts is), where only the server function runs it.
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
function isIP(value: string): boolean {
  if (IPV4.test(value)) return true;
  if (!value.includes(":") || /[[\]/@\s]/.test(value)) return false;
  try {
    return new URL(`http://[${value}]/`).hostname.length > 2;
  } catch {
    return false;
  }
}

export const RELAY_KEY_HEADER = "X-Qeet-Relay-Key";
export const RELAY_CLIENT_IP_HEADER = "X-Qeet-Client-IP";

/**
 * The person's address as this server sees it. Behind CONSOLE_TRUSTED_PROXY_HOPS
 * reverse proxies that append to X-Forwarded-For, it is the entry immediately
 * left of the ones they appended (counted from the right, so a forged leftmost
 * entry is ignored); with none, the connection's peer. null when unknown.
 */
export function clientAddress(request: Request, peer?: string | null): string | null {
  const hops = Number.parseInt(process.env.CONSOLE_TRUSTED_PROXY_HOPS ?? "0", 10);
  if (Number.isFinite(hops) && hops > 0) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p) => p.trim());
      const candidate = parts[parts.length - hops];
      if (candidate && isIP(candidate)) return candidate;
    }
    // A chain shorter than declared didn't come through the proxies: fall
    // back to the peer rather than trust a truncated chain.
  }
  return peer && isIP(peer) ? peer : null;
}

/** The headers that name the person's address to the API, or none. */
export function relayHeaders(request: Request, peer?: string | null): Record<string, string> {
  const key = process.env.QEET_ID_RELAY_KEY;
  if (!key) return {};
  const address = clientAddress(request, peer);
  if (!address) return {};
  return { [RELAY_KEY_HEADER]: key, [RELAY_CLIENT_IP_HEADER]: address };
}
