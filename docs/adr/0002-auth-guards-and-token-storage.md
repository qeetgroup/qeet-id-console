# ADR-0002: Client-side auth guards and localStorage token storage

**Status:** Accepted (with a tracked follow-up)

## Context

The console is an OIDC relying party with no server session of its own. It runs
SSR via Nitro. Access/refresh tokens must be available to the browser to call
the backend.

## Decision

- Store access + refresh tokens (and active tenant/user ids) in `localStorage`
  (`platform/auth/token-store.ts`), read reactively via `useSyncExternalStore`.
- Enforce route protection with client-side `useEffect` redirects, **not**
  `beforeLoad` — the token is invisible to the server, so a `beforeLoad` guard
  would bounce every authenticated hard-refresh to `/sign-in`.
- `api()` handles single-flight refresh + replay; a failed refresh clears state
  and redirects.

## Consequences

- Simple, works with SSR, no server session to manage.
- **Trade-off:** tokens are XSS-exfiltratable from localStorage. Mitigated by
  strict CSP/dependency hygiene and by keeping secrets out of the client.
- **Follow-up (deferred):** move to httpOnly, SameSite cookies. Requires
  `qeet-id-server` changes and reworking the guards to `beforeLoad`. Tracked in
  SECURITY.md.
