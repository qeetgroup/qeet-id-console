// Names the person's address to the API, which otherwise sees this server's for everyone: the
// relay key (QEET_ID_RELAY_KEY, server env only) vouches for it, and without the key the API
// ignores the claim, so a browser can't forge it.

// No node:net here: this module is bundled for the browser too, though only the server runs it.
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
 * Returns the person's address. Behind CONSOLE_TRUSTED_PROXY_HOPS proxies it is the
 * X-Forwarded-For entry that many places from the right, the one the outermost proxy appended
 * (so a forged leftmost entry is ignored); otherwise the connection's peer. null when unknown.
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

/** Returns the headers that name the person's address to the API, or none without a relay key. */
export function relayHeaders(request: Request, peer?: string | null): Record<string, string> {
  const key = process.env.QEET_ID_RELAY_KEY;
  if (!key) return {};
  const address = clientAddress(request, peer);
  if (!address) return {};
  return { [RELAY_KEY_HEADER]: key, [RELAY_CLIENT_IP_HEADER]: address };
}
