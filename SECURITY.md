# Security Model — Qeet ID Console

The console is an administrative control plane for an IAM/CIAM product. This
document records the client-side security decisions and their trade-offs.
**The backend is always the authority.** Everything here is UX, defence-in-depth,
or data-handling hygiene — never the enforcement boundary.

## Reporting

Report suspected vulnerabilities privately to the Qeet ID security team (do not
open a public issue). Include reproduction steps and impact.

## Authentication & session

- The console is a Qeet ID OIDC relying party. The operator's access + refresh
  tokens and the active tenant/user ids are stored in `localStorage`
  (`platform/auth/token-store.ts`).
- **Known trade-off (tracked):** localStorage tokens are readable by any script
  in the origin (XSS blast radius). Route guards are client-side `useEffect`
  redirects *because* the token is invisible to SSR. Migrating to httpOnly
  cookies requires `qeet-id-server` + SSR-guard changes and is deferred — see
  `docs/adr/0002-auth-guards-and-token-storage.md`.
- `api()` performs a single-flight `/v1/auth/refresh` on 401 and replays once;
  a failed refresh clears the session and hard-redirects to `/sign-in`.
- Conversations and other session-scoped client state are cleared on logout via
  the `onTokenStoreClear` registry.

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

- Tools execute **client-side under the operator's own token**, through the same
  `api()` path — so RBAC/RLS/audit apply identically. The AI can never exceed
  the operator's permissions and there is no separate/elevated path.
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
