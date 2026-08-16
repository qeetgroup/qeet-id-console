# ADR-0009: Server-resolved BFF session

**Status:** Accepted

## Context

The console previously stored backend access and refresh tokens in browser
`localStorage`. That made administrative sessions readable by any same-origin
script and forced protected routes to redirect after render because SSR could
not resolve identity.

The Qeet ID backend already issues short-lived access tokens, single-use rotating
refresh tokens, revocable session IDs, and backend-authoritative RBAC/RLS. The
console therefore needs a secure browser boundary, not a second identity system.

## Decision

- TanStack Start is the same-origin backend-for-frontend (BFF).
- Backend token pairs are encrypted and integrity-protected in a chunked
  `HttpOnly`, `SameSite=Lax`, `Path=/` cookie. Production uses `Secure` and the
  `__Host-` prefix. `SESSION_SECRET` is server-only and at least 32 characters.
- Browser code receives only `PublicSession`: authentication state, expiry,
  backend session/user/tenant IDs, a monotonically increasing session version,
  and safe impersonation display metadata. Tokens never cross the RPC boundary.
- `platform/api/server-proxy.ts` is the JSON BFF. It accepts validated relative
  paths, adds backend bearer authentication and correlation IDs, strips token
  pairs from explicit session-issuing endpoints, and never adopts token-shaped
  responses from credential-management endpoints.
- Activity and Qeet AI streams use fixed same-origin server routes backed by
  `platform/api/server-stream.ts`. Their backend path is fixed or allowlisted.
- Protected layouts call `getServerSession` in `beforeLoad`; anonymous routes
  reverse-redirect before rendering. Route guards are UX. Backend JWT, RBAC, and
  RLS remain the data authorization boundary.
- TanStack Start's same-origin CSRF middleware covers all server functions and
  non-safe server-route methods.
- Refresh is serialized across browser tabs with the Web Locks API. The refresh
  server function requires the caller's expected session version, so a stale
  tab or concurrent serverless request cannot rotate the same cookie generation.
  A final 401 refreshes once and replays once.
- Login and tenant changes rotate the encrypted BFF cookie and best-effort revoke
  the superseded backend session. Logout clears backend and BFF sessions and
  broadcasts the transition through `BroadcastChannel` with a storage-event
  fallback.
- Session reads do not create anonymous cookies. Legacy browser token keys are
  purged on startup and never read.

## Consequences

- Access and refresh tokens are unavailable to browser JavaScript and Web
  Storage.
- Hard refresh and SSR can resolve protected-route identity before rendering.
- The BFF adds server runtime and cookie-secret operational requirements.
- Same-origin RPC/stream endpoints must remain CSRF-protected and must validate
  every client-controlled path or input.
- `SESSION_SECRET` rotation invalidates existing console cookies; the operator
  signs in again while backend sessions remain independently revocable.
- Browser and server-session invariants are covered by unit tests plus Playwright
  tests for anonymous guards, cookie flags, hard refresh, CSRF, cross-tab logout,
  and single-use refresh coordination.
