# Qeet ID Console — Target Architecture

The layered structure the console was refactored into. See
`current-state.md` for the pre-refactor baseline and `../adr/` for the decisions.

## Layers

```
src/
├── app/            (bootstrap/providers — populated as needed)
├── routes/         file-based routes; URL + composition only (URLs unchanged)
├── modules/        one folder per business capability (the "features" layer)
│                     authentication · authorization · billing · compliance
│                     dashboard · developer · onboarding · organizations · qeetai
│                     security · users · activity · timeline · search
│                   each: api/ components/ hooks/ store/ utils/ schemas/ index.ts
│                          (only the subfolders it needs)
├── platform/       cross-cutting infrastructure
│                     api/ (the one HTTP client) · auth/ (token-store, refresh, session)
│                     errors/ · query/ · security/ (capabilities, step-up, sensitive-action)
│                     telemetry/ · feature-flags/ · config/ (env, navigation) · components/
├── shared/         generic, domain-agnostic: components/ hooks/ utils/ data/
└── i18n/           locales
```

> Terminology: business-capability folders live under `modules/` and generic
> helper folders are named `utils/` (there is no `features/` or `lib/`).

## Dependency rules (enforced by Biome in CI: `lint:boundaries`)

Allowed:

- `app → routes, modules, platform, shared`
- `routes → modules, platform, shared`
- `modules → platform, shared`, and `module → another module via its barrel` (`@/modules/<name>`)
- `platform → platform, shared`
- `shared → shared, i18n, external`

Forbidden (fail CI):

- `shared → modules / platform / routes / app`
- `platform → modules / routes / app`
- `modules → routes / app`
- `module A → module B internals` (`@/modules/x/<subpath>`)
- runtime import cycles (`noImportCycles`, type-only edges ignored)

## Data-access flow

```
route → feature page → feature hook → feature api/ → platform/api client → Qeet ID API
```

The `api()` client is the single request path: Bearer auth, single-flight 401
refresh + replay, `ApiError` normalization, `X-Request-Id` correlation, and
opt-in zod response validation. Feature components do not call `fetch` directly.

## Security spine

`platform/security` owns capability resolution (backend-authoritative, UX-only),
`AccessBoundary`, the step-up dialog, and `useSensitiveAction`
(capability → confirm → step-up → api). See ADR-0003 / ADR-0005 / ADR-0006.
