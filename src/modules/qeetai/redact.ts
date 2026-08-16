// PII redaction for values that leave the operator's screen — model context and
// persisted history. Masks emails and IPv4 addresses (the PII the tools surface:
// search_users emails, audit-log IPs) while preserving opaque IDs so the model
// can still make follow-up tool calls. Conservative on purpose: we do not mask
// numeric runs (would corrupt IDs/timestamps).

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

export function maskPII(text: string): string {
  return text.replace(EMAIL, "[redacted-email]").replace(IPV4, "[redacted-ip]");
}

/** Deep-mask emails/IPs in any string/array/object; other values pass through. */
export function redactPII<T>(value: T): T {
  if (typeof value === "string") return maskPII(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactPII(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactPII(v);
    return out as unknown as T;
  }
  return value;
}
