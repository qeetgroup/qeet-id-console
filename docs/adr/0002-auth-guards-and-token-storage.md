# ADR-0002: Client-side auth guards and localStorage token storage

**Status:** Superseded by ADR-0009

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
- The follow-up was completed by ADR-0009. This document remains as the
  historical record of the pre-BFF trust model.
