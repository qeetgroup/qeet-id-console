# Subsystem Map — qeet-id-console

**Level:** L2 (lightweight L3 navigation + L4 pointers) · **Last verified:** 2026-08-28
**Verification scope:** every path confirmed to exist; module list and barrel presence read from
the tree; layering compliance verified by grep.

A **navigation layer**: it answers *"where do I look next?"* and stops. Architecture is in
[context.md](context.md); source and tests are the deepest truth.

## Layer weights

```text
src/routes/     110 files   24,794 LOC
src/modules/    311 files   52,143 LOC   (17 modules)
src/platform/    49 files    4,306 LOC   (10 dirs)
src/shared/      18 files    1,291 LOC
```

Production files only (tests and `routeTree.gen.ts` excluded), counted 2026-10-23.

> `src/routes` holds 25k LOC despite the stated "URL concerns + composition only" rule — the largest
> gap between the documented architecture and the tree.

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
config/navigation.tsx          nav tree + getRequiredCapabilityForPath
```

**Tests** `api/__tests__/{client,server-request-policy}.test.ts` ·
`auth/__tests__/{server-session,session-response,session-store}.test.ts` ·
`security/__tests__/{capability-model,sensitive-action-provider}.test.*` ·
`errors/__tests__/normalize-error.test.ts` · `telemetry/__tests__/redact.test.ts` ·
`config/__tests__/navigation.test.ts`

---

## modules/ — 17 feature modules

**Path** `src/modules/` · **May import** `@/platform`, `@/shared`, `@/i18n`, and another module
**only through its barrel** (`@/modules/<name>`). Must not import `@/routes`.

| Module | Subdirs | Barrel | Test files |
|---|---|---|---|
| `activity` | `components`, `types` | yes | 7 |
| `authentication` | `api`, `components` | yes | 16 |
| `authorization` | `api`, `components`, `store`, `utils` | yes | 12 |
| `billing` | `api`, `components` | yes | 1 |
| `branding` | `api`, `components` | yes | 1 |
| `compliance` | `api` | yes | 2 |
| `dashboard` | `api`, `components` | yes | 7 |
| `developer` | `api`, `components` | yes | 1 |
| `directory` | `api`, `components` | yes | 2 |
| `groups` | `api`, `components` | yes | 1 |
| `onboarding` | flat | yes | 3 |
| `organizations` | `api`, `components` | yes | 1 |
| `qeetai` | `ai`, `api`, `components`, `context`, `hooks`, `store`, `suggestions`, `tools`, `types` | yes | 12 |
| `search` | `components`, `registry`, `store` | yes | 3 |
| `security` | `api` | yes | 2 |
| `timeline` | `components` | yes | 3 |
| `users` | `api` | yes | 7 |

Every module has an `index.ts` barrel (named exports) and tests.

**L4 pointer pattern** — every module follows `api/` (query/mutation fns) + `components/` +
an `index.ts` barrel. Example: `src/modules/dashboard/use-dashboard-activity.ts` reaches
`activity` correctly via `import { fetchActivityPage } from "@/modules/activity"`.

---

## routes/ — URL surface

**Path** `src/routes/` · **May import** anything below it, including module internals (the Biome
override applies only to files *under* `src/modules/**`).

| Group | Files | Notes |
|---|---|---|
| `_app/` | 85 | Authenticated operator shell. Wraps children in `CapabilityProvider > SensitiveActionProvider > AccessBoundary`. 10-minute idle logout |
| `_auth/` | 6 | `sign-in` `sign-up` `forgot-password` `magic` `invite.accept` `sso.callback` |
| `account/` | 4 | `profile` `security` `sessions` `data` — end-user self-service, deliberately outside the admin shell |
| `api/` | 2 | `activity-stream.ts`, `qeetai-stream.ts` — server-only SSE |

`_app/` sub-areas: `auth/`, `authorization/` (14 routes), `security/`, `settings/`, `users/`,
`groups/`, `organizations/`, `developer/`, plus `$.tsx` — a catch-all "Coming soon" that resolves
its title from `navGroups`.

Route tests (8 files) sit beside their route as `-<name>.test.tsx`, which the router generator ignores.

---

## shared/ — the bottom layer

**Path** `src/shared/` · **May import** only `@/shared`, `@/i18n`, or external packages.

```text
components/           confirm-dialog · logo-field · data-table/{bulk-bar,list-toolbar,selection,sort-header}
hooks/                use-list-view · use-shortcuts
utils/                data-export · format · initials · ip-format
data/regions.ts
```

---

## i18n

**Path** `src/i18n/` · 8 languages (`en hi fr de es pt ja zh`). `en` has 20 namespaces; the other
seven have 10 and fall back to `en`. Detection: `localStorage` then `navigator`, key `qeetid.lang`.
`humanizeMissingKey` ensures an operator never sees a raw key.

**Tests** `src/i18n/__tests__/index.test.ts`

---

## Where to go next

| You need | Read |
|---|---|
| How it works | [context.md](context.md) |
| A path, fast | [architecture-map.md](architecture-map.md) |
| What you may not change | [boundaries.md](boundaries.md) |
| Steps for a change | [workflows.md](workflows.md) |
| **Actual behaviour** | **the source and its tests** |
