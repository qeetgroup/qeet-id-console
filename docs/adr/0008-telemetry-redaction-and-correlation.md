# ADR-0008: Telemetry redaction and request correlation

**Status:** Accepted

## Context

The console had no observability layer and sent no correlation id, while the
backend already stamps `request_id`/`correlation_id` on audit/activity events.
Any future logging must never leak tokens, secrets, credentials, or PII.

## Decision

`platform/telemetry/`:

- `redact.ts` — the single guard: a hard **denylist** of key names
  (token/authorization/secret/password/refresh/client_secret/private_key/api_key/
  otp/recovery/cookie/credential/ssn) dropped entirely, plus **PII masking**
  (emails/IPs) on strings. All telemetry routes through it.
- `logger.ts` — leveled logger (console sink in DEV, no-op by default), payloads
  redacted.
- `errors.ts` — `captureError` reduces any throwable to `code`+`kind` (+context)
  before logging; `devDetail` only in DEV.
- `events.ts` — namespaced analytics events (`area.action`), redacted props.
- `tracing.ts` — `newRequestId()`; `api()` attaches it as `X-Request-Id` (shared
  across the refresh replay) to correlate a console error with the backend.

## Consequences

- One choke point makes "never log secrets/PII" enforceable and reviewable.
- Client telemetry is diagnostics only; **audit stays server-authoritative**.
