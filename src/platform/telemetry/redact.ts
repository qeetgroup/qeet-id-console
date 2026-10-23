// The one redaction step for everything that leaves the app as telemetry: values under
// denylisted key names are replaced, and emails and IPv4 addresses in strings are masked.
const DENY_KEY =
  /(token|authorization|secret|password|refresh|client_secret|private_key|api[-_]?key|otp|recovery|cookie|credential|ssn)/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

/** Returns true for a key whose value must never leave the app. */
export function isDeniedKey(key: string): boolean {
  return DENY_KEY.test(key);
}

function maskString(s: string): string {
  return s.replace(EMAIL, "[redacted-email]").replace(IPV4, "[redacted-ip]");
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
