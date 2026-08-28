# Security Model — Qeet ID Console

The console is an administrative control plane for an IAM/CIAM product. This
document records the client-side security decisions and their trade-offs.
**The backend is always the authority.** Everything here is UX, defence-in-depth,
or data-handling hygiene — never the enforcement boundary.

## Reporting

Report suspected vulnerabilities privately to the Qeet ID security team (do not
open a public issue). Include reproduction steps and impact.

## Authentication & session

- TanStack Start is a same-origin BFF. Access and refresh tokens are held only
  in an encrypted, integrity-protected `HttpOnly` cookie. Production cookies are
  `Secure`, `SameSite=Lax`, use `Path=/`, and use the `__Host-` prefix.
- The browser receives only safe session metadata; legacy access/refresh token
  keys are removed from Web Storage and never read.
- Protected routes resolve the server session in `beforeLoad`, before protected
  UI renders. Backend JWT verification, RBAC, and RLS remain authoritative.
- Refresh-token rotation is serialized across tabs and guarded by a session
  generation. A failed refresh clears the BFF cookie and redirects to sign-in.
- Same-origin CSRF validation covers server functions and mutating server routes.
- Conversations and other session-scoped client state are cleared on logout via
  the `onSessionClear` registry. Logout and tenant transitions propagate to
  other tabs through `BroadcastChannel` with a storage-event fallback.
- See `docs/adr/0009-server-resolved-bff-session.md`.

## Authorization

- The frontend fetches the backend-resolved **effective permission set** and
  mirrors it into a capability `Set` (`platform/security`). `can/canAll/canAny`
  and `AccessBoundary` gate UI only. A malformed permission payload **fails
  closed** (runtime-validated), never silently granting access.
- Backend RBAC + Postgres RLS remain authoritative on every request.

## Sensitive actions & step-up

- Sensitive mutations flow through `useSensitiveAction`
  (`platform/security/sensitive-action-provider.tsx`):
  capability pre-check → optional confirmation → run → on `step_up_required`
  open the re-auth dialog and retry once. Backend `RequireRecentMFA` is the real
  gate; the client just provides a consistent recovery path.

## Qeet AI

- Tools execute through the BFF under the operator's backend session, so
  RBAC/RLS/audit apply identically. The AI can never exceed the operator's
  permissions and there is no separate/elevated path.
- Mutating tools (create/assign/grant/rotate/disable, strict-MFA changes,
  OAuth-client minting) require **human confirmation**; execution is gated to the
  operator's **enabled** tool set; `step_up_required` opens the step-up dialog.
- **Secrets** (client secrets, private keys) are shown once, diverted to an
  in-memory store, and **never** sent to the model or written to localStorage.
- **PII** (emails, IPs) is masked before results reach the model and before the
  conversation is persisted. Opaque IDs are preserved for follow-up calls.

## Error handling & telemetry

- Raw backend messages are never rendered. Errors are normalised to a stable
  `code`/`kind` and mapped to curated, user-safe copy (`platform/errors`).
- Telemetry routes through a redaction guard (`platform/telemetry/redact.ts`)
  with a hard denylist (tokens/secrets/passwords/keys/cookies/credentials) and
  PII masking. Never log tokens, secrets, credential values, or private keys.
- Audit events are **server-authoritative**; the client only emits UX analytics
  and a correlation `X-Request-Id`.

## Environment

- Only `VITE_*` values are exposed to the browser (see `platform/config/env.ts`).
- Never place private keys, API secrets, service credentials, or signing secrets
  in client-side (`VITE_*`) environment variables.
- `SESSION_SECRET` and `SERVER_URL` are server-only. Production requires a
  random `SESSION_SECRET` of at least 32 characters.
