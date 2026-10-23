# Subsystem Map — qeet-id-console

**Level:** L2 (lightweight L3 navigation + L4 pointers) · **Last verified:** 2026-10-23
**Verification scope:** every path confirmed to exist; module list and barrel presence read from
the tree; layering compliance verified by grep.

A **navigation layer**: it answers *"where do I look next?"* and stops. Architecture is in
[context.md](context.md); source and tests are the deepest truth.

## Layer weights

```text
src/routes/     110 files    1,338 LOC
src/modules/    465 files   76,218 LOC   (18 modules)
src/platform/    55 files    4,818 LOC   (10 dirs)
src/shared/      22 files    1,391 LOC
```

Production files only (tests and `routeTree.gen.ts` excluded), counted 2026-10-23. Routes hold only
`createFileRoute`, guards and search schemas; the pages live in the modules.

---

## platform/ — the shared spine

**Path** `src/platform/` · **Security** **Critical** · **May import** only `@/platform`, `@/shared`,
`@/i18n` (Biome-enforced)

| Dir | Purpose |
|---|---|
| `api/` | The single HTTP path: browser client, server proxy, SSRF policy, SSE |
| `auth/` | Encrypted server session, client store (inert on the server), cross-tab transitions, per-person scoped browser storage |
| `security/` | Capability model, access boundary, step-up, sensitive action, response headers |
| `config/` | Client env schema, production server-config check, API origin, navigation tree + path→capability map |
| `errors/` | Error taxonomy and user-safe copy |
| `telemetry/` | Redaction, logger, events, tracing |
| `query/` | QueryClient, global 403 recapability handler |
| `feature-flags/` | `qeetai`, `authorization-builder` on; `risk-engine`, `new-dashboard` off |
| `components/` | `page-header.tsx`, `theme-toggle.tsx`, and the leak-safe `data-state.tsx` |
| `theme/` | Theme provider wiring |

**L4 pointers**

```text
api/client.ts                  browser entry — the ONLY request path
api/server-proxy.ts            bearer attachment, single-flight refresh, renews and replays once on a
                               backend 401 (signs out only on a rejected refresh token; timeouts on
                               every backend call)
api/server-request-policy.ts   SSRF guard — "escaped its configured origin"
api/server-stream.ts           SSE proxies (activity, qeetai)
auth/server-session.ts         __Host-qeet_console, chunked, PublicSession
auth/session-store.ts          BroadcastChannel, legacy-key purge; ignores writes on the server
auth/scoped-storage.ts         localStorage keyed by person + tenant, wiped on sign-out
auth/session-response.ts       token-issuing endpoint allowlist + stripBackendTokens
security/capability-model.ts   25 capabilities, classifyAccessMode
security/effective-permissions.ts   the source — parsing FAILS CLOSED
telemetry/redact.ts            denylist + email/IP masking
errors/user-message.ts         the leak stop
components/data-state.tsx      DataState that maps errors through the leak stop (lint-enforced)
config/server-config.ts        production config check, called from src/start.ts
security/security-headers.ts   response headers, applied by Nitro route rules (vite.config.ts)
config/navigation.tsx          nav types, useNavGroups (translated), getRequiredCapabilityForPath
config/nav-groups{,-admin}.tsx the nav tree; labels are `nav` catalogue keys
```

**Tests** `api/__tests__/{client,server-request-policy}.test.ts` ·
`auth/__tests__/{server-session,session-response,session-store}.test.ts` ·
`security/__tests__/{capability-model,sensitive-action-provider}.test.*` ·
`errors/__tests__/normalize-error.test.ts` · `telemetry/__tests__/redact.test.ts` ·
`config/__tests__/navigation.test.ts`

---

## modules/ — 18 feature modules

**Path** `src/modules/` · **May import** `@/platform`, `@/shared`, `@/i18n`, and another module
**only through its barrel** (`@/modules/<name>`). Must not import `@/routes`.

| Module | Subdirs | `pages.ts` | Test files |
|---|---|---|---|
| `account` | `api`, `components` | yes | 0 (route tests) |
| `activity` | `api`, `components`, `types` | yes | 7 |
| `authentication` | `api`, `components` | yes | 20 |
| `authorization` | `api`, `components`, `store`, `utils` | yes | 12 |
| `billing` | `api`, `components` | yes | 1 |
| `branding` | `api`, `components` | yes | 1 |
| `compliance` | `api`, `components` | yes | 2 |
| `dashboard` | `api`, `components` | yes | 7 |
| `developer` | `api`, `components` | yes | 2 |
| `directory` | `api`, `components` | yes | 3 |
| `groups` | `api`, `components` | yes | 2 |
| `onboarding` | flat | — | 3 |
| `organizations` | `api`, `components` | yes | 2 |
| `qeetai` | `ai`, `api`, `components`, `context`, `hooks`, `store`, `suggestions`, `tools`, `types` | yes | 12 |
| `search` | `api`, `components`, `registry`, `store` | — | 3 |
| `security` | `api`, `components` | yes | 2 |
| `timeline` | `api`, `components` | yes | 3 |
| `users` | `api`, `components` | yes | 11 |

Every module has an `index.ts` barrel (named exports, what other modules use). A module with screens
has a `pages.ts` (what routes render) and an `api/keys.ts` query-key factory, each key starting
`[module, tenantId]`. The few reads that aren't a tenant's say so in their factory: the person's
own sign-in data and the pre-sign-in flows (`authentication`), Qeet AI's status (`qeetai`) and the
plan catalogue (`billing`). The profile is the platform's `meKeys`.

**L4 pointer pattern** — `src/modules/users` is the reference: `api/keys.ts` + `api/*.ts`
(`queryOptions`, hooks, mutations) + `components/` (pages on the forms kit) + `pages.ts` + an
`index.ts` barrel. Another module reads its data through those `queryOptions`, so the dashboard's
tiles share the owning module's cache entry.

---

## routes/ — URL surface

**Path** `src/routes/` · **May import** module barrels and `pages` entries, `@/platform`
(except `api`) and `@/shared`; never module internals, `api()` or `@tanstack/react-query`
(Biome-enforced, no exemptions).

| Group | Files | Notes |
|---|---|---|
| `_app/` | 91 | Authenticated operator shell. Wraps children in `CapabilityProvider > SensitiveActionProvider > AccessBoundary`. 10-minute idle logout |
| `_auth/` | 6 | `sign-in` `sign-up` `forgot-password` `magic` `invite.accept` `sso.callback` |
| `account/` | 4 | `profile` `security` `sessions` `data` — end-user self-service, deliberately outside the admin shell |
| `api/` | 2 | `activity-stream.ts`, `qeetai-stream.ts` — server-only SSE |

`_app/` sub-areas: `auth/`, `authorization/` (15 routes), `security/`, `settings/`, `users/`,
`groups/`, `organizations/`, `developer/`, `directory/`, plus `$.tsx` — the catch-all "Page not
found" (the dashboard's `NotFoundPage`) for any console address no route matches.

Route tests (49 files) sit beside their route as `-<name>.test.tsx`, which the router generator
ignores; they render the route's component, so they exercise the module page through it.

---

## shared/ — the bottom layer

**Path** `src/shared/` · **May import** only `@/shared`, `@/i18n`, or external packages.

```text
components/           confirm-dialog · logo-field · one-time-secret · page-state · qeet-mark ·
                      unsaved-changes-guard · data-table/{bulk-bar,list-toolbar,selection,sort-header}
hooks/                use-create-intent · use-list-view · use-shortcuts
utils/                data-export · format · initials · ip-format · search-params
data/                 country-dial-codes · regions · team-sizes
```

---

## i18n

**Path** `src/i18n/` · 8 locales with files (`en hi fr de es pt ja zh`), 1 offered. `en` has 19
namespaces; the other seven have 10 (about 7% of the keys), so only English is offered
(`OFFERED_LANGUAGES`) until one is complete. Detection: `localStorage` then `navigator`, key
`qeetid.lang`. `humanizeMissingKey` ensures an operator never sees a raw key.

**Tests** `src/i18n/__tests__/{index,offered-languages,catalogue-keys}.test.ts` — the last fails on
a static key the source uses that `en` lacks.

---

## Where to go next

| You need | Read |
|---|---|
| How it works | [context.md](context.md) |
| A path, fast | [architecture-map.md](architecture-map.md) |
| What you may not change | [boundaries.md](boundaries.md) |
| Steps for a change | [workflows.md](workflows.md) |
| **Actual behaviour** | **the source and its tests** |
