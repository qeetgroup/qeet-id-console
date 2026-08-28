# Subsystem Map — qeet-id-console

**Level:** L2 (lightweight L3 navigation + L4 pointers) · **Last verified:** 2026-08-28
**Verification scope:** every path confirmed to exist; module list and barrel presence read from
the tree; layering compliance verified by grep.

A **navigation layer**: it answers *"where do I look next?"* and stops. Architecture is in
[context.md](context.md); source and tests are the deepest truth.

## Layer weights

```text
src/routes/     101 files   25,362 LOC
src/modules/    249 files   32,173 LOC   (14 modules)
src/platform/    48 files    3,746 LOC   (9 dirs)
src/shared/      14 files      891 LOC
```

> `src/routes` holds 25k LOC despite the stated "URL concerns + composition only" rule — the largest
> gap between the documented architecture and the tree.

---

## platform/ — the shared spine

**Path** `src/platform/` · **Security** **Critical** · **May import** only `@/platform`, `@/shared`,
`@/i18n` (Biome-enforced)

| Dir | Purpose |
|---|---|
| `api/` | The single HTTP path: browser client, server proxy, SSRF policy, SSE |
| `auth/` | Encrypted server session, client store, cross-tab transitions |
| `security/` | Capability model, access boundary, step-up, sensitive action |
| `config/` | Env schema, API origin, navigation tree + path→capability map |
| `errors/` | Error taxonomy and user-safe copy (ADR-0004) |
| `telemetry/` | Redaction, logger, events, tracing (ADR-0008) |
| `query/` | QueryClient, global 403 recapability handler |
| `feature-flags/` | `qeetai`, `authorization-builder` on; `risk-engine`, `new-dashboard` off |
| `components/` | `page-header.tsx` only |

**L4 pointers**

```text
api/client.ts                  browser entry — the ONLY request path
api/server-proxy.ts            bearer attachment, single-flight refresh
api/server-request-policy.ts   SSRF guard — "escaped its configured origin"
api/server-stream.ts           SSE proxies (activity, qeetai)
auth/server-session.ts         __Host-qeet_console, chunked, PublicSession
auth/session-store.ts          BroadcastChannel, legacy-key purge
auth/session-response.ts       token-issuing endpoint allowlist + stripBackendTokens
security/capability-model.ts   25 capabilities, classifyAccessMode
security/effective-permissions.ts   the source — parsing FAILS CLOSED
telemetry/redact.ts            denylist + email/IP masking
errors/user-message.ts         the leak stop
config/navigation.tsx          nav tree + getRequiredCapabilityForPath (645 lines)
```

**Tests** `api/__tests__/{client,server-request-policy}.test.ts` ·
`auth/__tests__/{server-session,session-response,session-store}.test.ts` ·
`security/__tests__/{capability-model,sensitive-action-provider}.test.*` ·
`errors/__tests__/normalize-error.test.ts` · `telemetry/__tests__/redact.test.ts` ·
`config/__tests__/navigation.test.ts` · E2E `tests/e2e/session-boundary.spec.ts`

---

## modules/ — 14 feature modules

**Path** `src/modules/` · **May import** `@/platform`, `@/shared`, `@/i18n`, and another module
**only through its barrel** (`@/modules/<name>`). Must not import `@/routes`.

| Module | Subdirs | Barrel | Tests |
|---|---|---|---|
| `activity` | `components`, `types`, `__tests__` | yes | 6 |
| `authentication` | `api`, `components` | yes | 1 |
| `authorization` | `api`, `components`, `store`, `utils` | yes | — |
| `billing` | `api`, `components` | yes | — |
| `compliance` | `api` | **no** | — |
| `dashboard` | `api`, `components`, `__tests__` | **no** | 2 |
| `developer` | `api` | yes | — |
| `onboarding` | flat | yes | — |
| `organizations` | `api` | yes | — |
| `qeetai` | 9 dirs, 49 files — **largest** | yes | 3 |
| `search` | `components`, `registry`, `store`, `__tests__` | yes | 3 |
| `security` | `api` | yes | — |
| `timeline` | `components`, `__tests__` | yes | 3 |
| `users` | `api` | yes | — |

**Two modules have no barrel** (`compliance`, `dashboard`) — so they cannot be imported by another
module without violating the layering rule. **Seven have no tests**: `authorization`, `billing`,
`compliance`, `developer`, `onboarding`, `organizations`, `security`, `users`.

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

**No tests exist for `src/routes/**`.**

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
