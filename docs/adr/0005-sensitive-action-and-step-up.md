# ADR-0005: Unified sensitive-action + step-up primitive

**Status:** Accepted

## Context

Step-up re-authentication (`StepUpDialog` on a backend `step_up_required`) was
wired to exactly one screen (TOTP). Every other sensitive action used a plain
confirm dialog; if the backend demanded step-up, the user hit a dead-end generic
403 toast with no way to recover.

## Decision

Introduce one primitive, `useSensitiveAction` + `SensitiveActionProvider`
(`platform/security`), mounted once in `_app` inside `CapabilityProvider`. It
owns a single shared confirm dialog and a single `StepUpDialog`:

```
capability pre-check → optional confirm → run()
  → on step_up_required: open StepUpDialog → retry run() once → else cancel
  → other errors propagate to the global handler
```

The global handler no longer toasts `step_up_required` (the primitive handles
it). Adopted first at the highest-risk site (`user360/danger-zone`); other
confirm sites migrate incrementally.

## Consequences

- Sensitive actions recover from step-up consistently instead of dead-ending.
- Backend `RequireRecentMFA` stays authoritative; the client only re-verifies
  and retries. Cancellation surfaces as a typed `SensitiveActionCancelled`.
