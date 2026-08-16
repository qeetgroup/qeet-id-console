# ADR-0004: Error taxonomy and user-safe messages

**Status:** Accepted

## Context

There was no React error boundary (an uncaught throw white-screened), and the
global toast printed the raw backend `error.message`, risking leakage of
internal detail.

## Decision

`platform/errors/` layers on top of the transport `ApiError`:

- `error-codes.ts` — stable code catalogue + `ErrorKind`.
- `app-error.ts` — `AppError` discriminated by `kind`
  (auth/authz/validation/network/api/unknown).
- `normalize-error.ts` — coerces any throwable into an `AppError` by status/code.
- `user-message.ts` — `userMessageForCode()`: curated copy for known codes,
  generic per-kind fallback otherwise. **This is the leak stop.**
- `error-component.tsx` — router `defaultErrorComponent`; renders safe copy and
  reports via telemetry, never the raw message.

The global query/mutation handler and inline error UIs render
`userMessageForCode(...)`, never `error.message`/`detail`.

## Consequences

- Backend-internal strings never reach the UI.
- Unmapped codes degrade to generic copy; seed the ~dozen live codes to keep
  common flows meaningful. `devDetail` is DEV-only.
