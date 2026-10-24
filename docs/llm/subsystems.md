# Subsystem Map — qeet-id-console

**Level:** L2 (lightweight L3 navigation + L4 pointers) · **Last verified:** 2026-10-23
**Verification scope:** every path confirmed to exist; module list and barrel presence read from
the tree; layering compliance verified by grep.

A **navigation layer**: it answers *"where do I look next?"* and stops. Architecture is in
[context.md](context.md); source and tests are the deepest truth.

## Layer weights

```text
src/app/          3 files       66 LOC
src/routes/       5 files      257 LOC   (the shell: __root, _app, healthz, api/)
src/modules/    638 files   81,317 LOC   (18 modules; 105 route files, 1,162 LOC, among them)
src/platform/    60 files    4,671 LOC   (13 dirs)
src/shared/      21 files    1,310 LOC
```

Production files only (tests and `routeTree.gen.ts` excluded), counted 2026-10-23. A module's
routes live in its own `routes/` folder and hold only `createFileRoute`, `staticData`, guards and
search schemas; the pages live beside them in the module.

---

## app/ — the composition root

**Path** `src/app/` · **May import** anything; nothing imports it except `src/router.tsx`,
`vite.config.ts` and the test setup.

```text
modules.ts    MODULES — the module list, in sidebar order; the one line a new module adds
routes.ts     the route tree: the shell's files plus every module's routes/{public,app} folder
register.ts   loads every src/modules/*/manifest.tsx (in MODULES order) into the platform registry
```

**Tests** `src/__tests__/module-registry.test.ts` (folders = `MODULES`, namespaces = locale
folders, every nav/command/shortcut target is a real route, a fake module shows up everywhere) ·
`module-boundaries.test.ts` · `route-capability.test.ts` · `feature-flags.test.ts` ·
`scoped-stores.test.ts` · `scope-switch.test.ts`.

---

## platform/ — the shared spine

**Path** `src/platform/` · **Security** **Critical** · **May import** only `@/platform`, `@/shared`,
`@/i18n` (Biome-enforced)

| Dir | Purpose |
|---|---|
| `api/` | The single HTTP path: browser client, server proxy (and its log lines), SSRF policy, SSE, the keepalive fetch telemetry reports use |
| `auth/` | Encrypted server session, client store (inert on the server), cross-tab transitions, per-person scoped browser storage |
| `security/` | Capability model, route capability, access boundary, step-up, sensitive action, response headers |
| `config/` | Client env schema, production server-config check, public runtime config (API origin, flags turned off), sidebar groups, the sidebar built from manifests |
| `modules/` | The `ModuleManifest` type and the registry `src/app` fills; the platform reads modules only through it |
| `keyboard/` | Global `g` shortcuts, from the manifests |
| `feature-flags/` | Evaluates the flags modules declare; `CONSOLE_FLAGS_OFF` turns any off at runtime |
| `errors/` | Error taxonomy and user-safe copy |
| `telemetry/` | Redaction, the server's JSON-line log (production, stdout, server-only), path templates, the browser error and Web Vitals reporter and its report endpoint, the DEV console logger, `captureError`, request ids (`tracing.ts`); nothing goes to a third party |
| `query/` | QueryClient, global 403 recapability handler |
| `forms/` | The forms kit: TanStack Form + `@qeetrix/ui` fields, server field errors |
| `components/` | `page-header.tsx`, `theme-toggle.tsx`, `error-reference.tsx`, the leak-safe `data-state.tsx` and `status-pill.tsx` (status words from the catalogue) |
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
auth/idle-activity.ts          idle sign-out shared by every tab (a bare localStorage timestamp)
auth/session-response.ts       token-issuing endpoint allowlist + stripBackendTokens
security/capability-model.ts   25 capabilities, classifyAccessMode
security/effective-permissions.ts   the source — parsing FAILS CLOSED
telemetry/redact.ts            denylist + token/query/email/IP masking
telemetry/server-log.ts        one JSON line per event on stdout; production builds; server-only
telemetry/client-reporter.ts   browser errors + Web Vitals: deduped, ≤10 a page load, templates
telemetry/client-report.ts     reportClientTelemetry server function: Zod allowlist and bounds
api/server-proxy-log.ts        api.request / session.refresh lines for proxyApiRequest
errors/user-message.ts         the leak stop
components/data-state.tsx      DataState that maps errors through the leak stop (lint-enforced)
components/status-pill.tsx     StatusPill naming a status from `common:status.*` (lint-enforced)
config/server-config.ts        production config check, called from src/start.ts
security/security-headers.ts   response headers, applied by Nitro route rules (vite.config.ts)
security/content-security-policy.ts  the nonce CSP, set per response by src/start.ts
security/route-capability.ts   staticData.capability per route; getRequiredCapabilityForPath
modules/manifest.ts            ModuleManifest, defineModule, the ModuleExtensions extension point
modules/registry.ts            registerModules + navContributions/commandContributions/…
config/navigation.tsx          getNavGroups (built from the manifests), useNavGroups (translated)
config/nav-groups.tsx          the 8 sidebar groups and their icons; labels are `common:navGroup.*`
config/public-config.ts        what the server hands the browser at runtime (API origin, flags off)
feature-flags/evaluation.ts    evaluateFlags — declared default, unless the deployment turns it off
keyboard/shortcuts.ts          useGlobalShortcuts, shortcutGroups (the shortcuts dialog)
```

**Tests** `api/__tests__/{client,server-request-policy}.test.ts` ·
`auth/__tests__/{server-session,session-response,session-store}.test.ts` ·
`security/__tests__/{capability-model,sensitive-action-provider}.test.*` ·
`errors/__tests__/normalize-error.test.ts` ·
`telemetry/__tests__/{redact,path-template,server-log,client-report,client-reporter}.test.ts` ·
`api/__tests__/server-proxy-log.test.ts` ·
`config/__tests__/navigation.test.ts`

---

## modules/ — 18 feature modules

**Path** `src/modules/` · **May import** `@/platform`, `@/shared`, `@/i18n`, and another module
**only through its barrel** (`@/modules/<name>`). Must not import `@/routes` or `@/app`.

| Module | Subdirs (besides `locales`) | Routes (`app` / `public`) | Test files |
|---|---|---|---|
| `account` | `api`, `components`, `routes` | 0 / 5 | 5 |
| `activity` | `api`, `components`, `routes`, `types` | 1 / 0 | 7 |
| `authentication` | `api`, `components`, `routes` | 16 / 9 | 35 |
| `authorization` | `api`, `components`, `routes`, `store`, `utils` | 15 / 0 | 17 |
| `billing` | `api`, `components`, `routes` | 1 / 0 | 1 |
| `branding` | `api`, `components`, `routes` | 1 / 0 | 1 |
| `compliance` | `api`, `components`, `routes` | 4 / 0 | 4 |
| `dashboard` | `api`, `components`, `routes` | 6 / 0 | 7 |
| `developer` | `api`, `components`, `routes` | 12 / 0 | 11 |
| `directory` | `api`, `components`, `routes` | 6 / 0 | 5 |
| `groups` | `api`, `components`, `routes` | 2 / 0 | 3 |
| `onboarding` | flat | — | 3 |
| `organizations` | `api`, `components`, `routes` | 7 / 0 | 6 |
| `qeetai` | `ai`, `api`, `components`, `context`, `hooks`, `routes`, `store`, `suggestions`, `tools`, `types` | 1 / 0 | 13 |
| `search` | `api`, `components`, `registry`, `store` | — | 3 |
| `security` | `api`, `components`, `routes` | 12 / 0 | 10 |
| `timeline` | `api`, `components`, `routes` | 1 / 0 | 3 |
| `users` | `api`, `components`, `routes` | 6 / 0 | 12 |

Every module has an `index.ts` barrel (named exports, what other modules use), a `manifest.tsx`
(what it adds to the shell: sidebar entries, palette commands, `g` shortcuts, feature flags, Qeet AI
suggestions; and the type declaration of its translation namespaces) and its own
`locales/<lng>/<namespace>.json`. A module with screens has a `pages.ts`
(what routes render) and an `api/keys.ts` query-key factory, each key starting
`[module, tenantId]`. The few reads that aren't a tenant's say so in their factory: the person's
own sign-in data and the pre-sign-in flows (`authentication`), Qeet AI's status (`qeetai`) and the
plan catalogue (`billing`). The profile is the platform's `meKeys`.

`bun run new-module <id>` (`scripts/new-module.mjs`) creates one from the template — api, page,
route, manifest, catalogue, test — and adds its id to `src/app/modules.ts`.

**L4 pointer pattern** — `src/modules/users` is the reference: `api/keys.ts` + `api/*.ts`
(`queryOptions`, hooks, mutations) + `components/` (pages on the forms kit) + `pages.ts` + an
`index.ts` barrel. Another module reads its data through those `queryOptions`, so the dashboard's
tiles share the owning module's cache entry.

---

## Routes — URL surface

**Path** `src/modules/<id>/routes/{app,public}/` plus the shell in `src/routes/` · **May import**
module barrels and `pages` entries, `@/platform` (except `api`) and `@/shared`; never another
module's internals, `api()` or `@tanstack/react-query` (Biome-enforced, no exemptions).

`src/app/routes.ts` builds the tree (`virtualRouteConfig`): each module's `routes/public/` mounts at
the root, each `routes/app/` inside the `_app` layout. The URL is the path under that folder, so a
module's routes may share a prefix with another's (`/auth/…` is `authentication`'s and
`developer`'s; `/settings/…` is `organizations'`, `branding`'s and `billing`'s).

| Where | Files | Notes |
|---|---|---|
| `src/routes/_app.tsx` | 1 | Authenticated operator shell. Wraps children in `CapabilityProvider > SensitiveActionProvider > AccessBoundary`. 10-minute idle logout, measured across every tab |
| `src/routes/__root.tsx`, `healthz.ts` | 2 | Document, theme, toaster; the container health check |
| `src/routes/api/` | 2 | `activity-stream.ts`, `qeetai-stream.ts` — server-only SSE |
| `*/routes/app/` | 91 | Every page inside the shell; the catch-all "Page not found" is `dashboard/routes/app/$.tsx` |
| `authentication/routes/public/` | 9 | `_auth.tsx` (reverse guard) with `sign-in` `sign-up` `forgot-password` `magic` `invite.accept` `sso.callback`; `select-organization`, `verify-email` |
| `account/routes/public/` | 5 | `account.tsx` with `profile` `security` `sessions` `data` — end-user self-service, deliberately outside the admin shell |

A route states the capability its page requires as `staticData: { capability }`; the router hands
them to `registerRouteRequirements` once built.

Route tests (49 files) sit beside their route as `-<name>.test.tsx`, which the router generator
ignores; they render the route's component, so they exercise the module page through it.

---

## shared/ — the bottom layer

**Path** `src/shared/` · **May import** only `@/shared`, `@/i18n`, or external packages.

```text
components/           confirm-dialog · logo-field · one-time-secret · page-state · qeet-mark ·
                      unsaved-changes-guard · data-table/{bulk-bar,list-toolbar,selection,sort-header}
hooks/                use-create-intent · use-list-view
utils/                data-export · format · initials · ip-format · search-params
data/                 country-dial-codes · regions · team-sizes
```

---

## i18n

**Path** `src/i18n/` (setup, plus the platform's `common` and `errors`) and each module's
`locales/<lng>/<namespace>.json` · 8 locales with files (`en hi fr de es pt ja zh`), 1 offered.
`en` has 27 namespaces, each owned by one module; the other seven have 10 (about 5% of the keys),
so only English is offered (`OFFERED_LANGUAGES`) until one is complete. English is bundled; another
language is fetched when chosen, and on a server render the router hands the chosen language to the
browser, which loads it before hydrating. Detection: `localStorage` then `navigator`, key
`qeetid.lang`. `humanizeMissingKey` ensures an operator never sees a raw key. Keys are typed from
the `en` catalogues (`ResourceNamespaceMap`, declared per owner; `TranslationKey`,
`translateDynamic`, `isTranslationKey` in `src/i18n/index.ts`), so an unknown key fails the
typecheck.

**Tests** `src/i18n/__tests__/{index,offered-languages,catalogue-keys,locale-parity}.test.ts` —
`catalogue-keys` fails on a key the source uses (static, or a dynamic prefix) that `en` lacks;
`locale-parity` on a namespace two modules claim or a key another locale has that `en` doesn't.

---

## Where to go next

| You need | Read |
|---|---|
| How it works | [context.md](context.md) |
| A path, fast | [architecture-map.md](architecture-map.md) |
| What you may not change | [boundaries.md](boundaries.md) |
| Steps for a change | [workflows.md](workflows.md) |
| **Actual behaviour** | **the source and its tests** |
