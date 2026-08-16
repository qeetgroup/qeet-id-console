// Redaction for anything that leaves the app as telemetry (logs, events, error
// reports). Two layers: a hard denylist of key names that must NEVER be emitted,
// and PII masking (emails/IPs) on string values. This is the single guard every
// telemetry module routes through.
const DENY_KEY =
  /(token|authorization|secret|password|refresh|client_secret|private_key|api[-_]?key|otp|recovery|cookie|credential|ssn)/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

function maskString(s: string): string {
  return s.replace(EMAIL, "[redacted-email]").replace(IPV4, "[redacted-ip]");
}

/** Deep-redact: drop denylisted keys entirely, mask PII in strings. */
export function redact(value: unknown): unknown {
  if (typeof value === "string") return maskString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (DENY_KEY.test(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = redact(v);
    }
    return out;
  }
  return value;
}
