# ADR-0003: Backend-authoritative authorization; client capabilities are UX-only

**Status:** Accepted

## Context

The console needs to show/hide actions by permission, but a frontend can never
be trusted to enforce access.

## Decision

- Fetch the backend-resolved **effective permission set** and mirror it into a
  capability `Set` (`platform/security/effective-permissions.ts` +
  `capability-provider.tsx`). Expose `can/canAll/canAny/canAccessPath`.
- Use it only for UX: enabling/disabling actions, `AccessBoundary` page gating,
  capability discovery.
- Never re-implement RBAC/ABAC evaluation on the client. The backend (RBAC +
  Postgres RLS) decides on every request.
- The effective-permissions response is runtime-validated (ADR-0006) so a
  malformed payload **fails closed** rather than producing a garbage Set.

## Consequences

- Client and server authorization cannot silently diverge into a false "allow".
- A 403 anywhere invalidates and refetches the capability set.
