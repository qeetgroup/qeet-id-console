// Redaction for what leaves the operator's screen: model context and persisted history.
import { isDeniedKey } from "@/platform/telemetry/redact";

// Keys on the telemetry denylist that name metadata about a secret (`password_min_length`,
// `api_key_id`, `token_endpoint`) keep their value: it is no secret, and the model needs it.
const SECRET_METADATA_KEY =
  /(^|_)(id|ids|count|length|min|max|ttl|expires_at|expiry|enabled|required|policy|endpoint|url|uri|type|types|hint|last4|prefix|status|method|methods|created_at|updated_at|rotated_at|last_used_at)$/i;

function isSecretKey(key: string): boolean {
  return isDeniedKey(key) && !SECRET_METADATA_KEY.test(key);
}

// Only strings hold a secret; a boolean or count under a secret key carries none.
function isSecretValue(value: unknown): boolean {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

/** Masks emails and IPv4 addresses. Numeric runs are kept: masking would corrupt IDs. */
export function maskPII(text: string): string {
  return text.replace(EMAIL, "[redacted-email]").replace(IPV4, "[redacted-ip]");
}

/**
 * Deep-redacts a value: replaces secret-keyed strings and masks emails and IPs. Opaque IDs pass
 * through, so the model can still make follow-up tool calls.
 */
export function redactPII<T>(value: T): T {
  if (typeof value === "string") return maskPII(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactPII(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSecretKey(k) && isSecretValue(v) ? "[redacted]" : redactPII(v);
    }
    return out as unknown as T;
  }
  return value;
}
