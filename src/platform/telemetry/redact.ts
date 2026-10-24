// The one redaction step for everything that leaves the app as telemetry: values under
// denylisted key names are replaced, and tokens, query strings, emails and IPv4 addresses in
// strings are masked.
const DENY_KEY =
  /(token|authorization|secret|password|refresh|client_secret|private_key|api[-_]?key|otp|recovery|cookie|credential|ssn)/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const JWT = /\beyJ[\w-]+\.[\w-]+(?:\.[\w-]*)*/g; // JWS and JWE compact forms
const AUTH_SCHEME = /\b(Bearer|Basic)\s+[\w~+/.=-]+/gi;
const QUERY = /\?[^\s#"'<>)]*=[^\s#"'<>)]*/g; // can hold a one-time token under any key
const OPAQUE_RUN = /[\w-]{32,}/g; // long enough to be a refresh token, API key or hash
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true for a key whose value must never leave the app. */
export function isDeniedKey(key: string): boolean {
  return DENY_KEY.test(key);
}

// Random base64url or hex is about half digits and capitals; a long word such as a chunk name
// (`sensitive-action-provider-BXYp1Ixz`) is mostly lowercase. A bare UUID is an id, kept.
function maskOpaque(run: string): string {
  if (UUID.test(run) || !/\d/.test(run) || !/[A-Za-z]/.test(run)) return run;
  const dense = run.replace(/[^A-Z0-9]/g, "").length;
  return dense / run.length >= 0.3 ? "[redacted-token]" : run;
}

function maskString(s: string): string {
  return s
    .replace(JWT, "[redacted-token]")
    .replace(AUTH_SCHEME, "$1 [redacted-token]")
    .replace(EMAIL, "[redacted-email]")
    .replace(IPV4, "[redacted-ip]")
    .replace(QUERY, "?[redacted-query]")
    .replace(OPAQUE_RUN, maskOpaque);
}

/** Deep-copies a value, replacing denylisted keys' values with "[redacted]" and masking PII. */
export function redact(value: unknown): unknown {
  if (typeof value === "string") return maskString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isDeniedKey(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = redact(v);
    }
    return out;
  }
  return value;
}
