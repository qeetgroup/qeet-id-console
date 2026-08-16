# ADR-0001: Layered architecture with enforced boundaries

**Status:** Accepted

## Context

`src/lib` had become a 48-file "god folder" mixing the HTTP client, session/token
state, domain data-clients, pure logic, static data, UI hooks, and security.
The README documented boundaries that the code no longer followed, and nothing
enforced them.

## Decision

Adopt five layers with a one-directional dependency rule:

```
app → routes → features → platform → shared
```

- **shared** — generic, domain-agnostic UI/utils; imports only shared/i18n/external.
- **platform** — cross-cutting infrastructure (api, auth/session, errors, query,
  security, telemetry, feature-flags, config); imports only platform/shared.
- **features** — one folder per business capability; may import platform/shared
  and other features **only via their public barrel** (`@/features/<name>`).
- **routes** — URL/composition; may import features/platform/shared.
- **app** — bootstrap/providers.

Enforced with Biome `noRestrictedImports` overrides + `noImportCycles` (every
cross-layer import already uses the `@/*` alias), wired into CI as
`lint:boundaries`. Migration used move-file + temporary re-export shims so the
build stayed green at every step.

## Consequences

- Boundary violations fail CI, not code review.
- `src/lib` is retired (shims removed in cleanup); each feature owns its contract.
- `@/lib` and cross-feature-internal patterns start as tolerated and flip to
  `error` once the shims are gone.
