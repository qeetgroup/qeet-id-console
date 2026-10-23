# Architecture Map — qeet-id-console

**Level:** L2 · **Last verified:** 2026-10-23
**Verification scope:** every path below was confirmed to exist.

| Need | Path |
|---|---|
| Repository identity | [`qeet-repo.yml`](../../qeet-repo.yml) |
| Agent instructions | [`AGENTS.md`](../../AGENTS.md) |
| Subsystem map + real paths | [`subsystems.md`](subsystems.md) |

## Entry points

| Concern | Path |
|---|---|
| Router construction (registers route capabilities, hands the language to the browser) | `src/router.tsx` |
| **Module list — the one line a new module adds** | `src/app/modules.ts` |
| Route tree config (shell + every module's `routes/`) | `src/app/routes.ts` (read by `vite.config.ts`) |
| Manifest registration | `src/app/register.ts` |
| **Start instance: CSRF middleware + production config check** | `src/start.ts` |
| Generated route tree — **never hand-edit** | `src/routeTree.gen.ts` |
| Root layout, theme, toaster | `src/routes/__root.tsx` |
| Global styles | `src/styles.css` |
| Test polyfills | `src/test-setup.ts` |

## Route groups

A module's routes live in `src/modules/<id>/routes/`: `app/` mounts inside the `_app` shell,
`public/` at the root. The path under that folder is the URL.

| Group | Layout | Guard |
|---|---|---|
| `src/modules/*/routes/app/` | `src/routes/_app.tsx` | authenticated — redirects to `/sign-in` |
| `src/modules/authentication/routes/public/_auth/` | `…/public/_auth.tsx` | **reverse** — redirects away if signed in |
| `src/modules/account/routes/public/account/` | `…/public/account.tsx` | authenticated; end-user self-service, outside the admin shell |
| `src/routes/api/` | — | server-only SSE handlers |

## The BFF — the one path to the backend

| Concern | Path |
|---|---|
| **Browser entry — the ONLY request path** | `src/platform/api/client.ts` |
| **Server proxy, bearer attachment, refresh** | `src/platform/api/server-proxy.ts` |
| **SSRF guard** | `src/platform/api/server-request-policy.ts` |
| SSE proxying (server side) | `src/platform/api/server-stream.ts` |
| **Browser stream transport — the ONLY stream path** | `src/platform/api/event-stream.ts` |
| **Encrypted session cookie** | `src/platform/auth/server-session.ts` |
| Client session store, cross-tab (inert on the server) | `src/platform/auth/session-store.ts` |
| **Per-person browser storage, wiped on sign-out** | `src/platform/auth/scoped-storage.ts` |
| Token-issuing endpoint allowlist | `src/platform/auth/session-response.ts` |
| Session helpers / auth-lost | `src/platform/auth/session.ts`, `auth-lost.ts` |

## Security

| Concern | Path |
|---|---|
| **25 capabilities, access modes** | `src/platform/security/capability-model.ts` |
| Capability source (fails closed) | `src/platform/security/effective-permissions.ts` |
| Provider — `can`/`canAll`/`canAny` | `src/platform/security/capability-provider.tsx` |
| Page gating | `src/platform/security/access-boundary.tsx` |
| **Route → required capability** (`staticData: { capability }`) | `src/platform/security/route-capability.ts` |
| **Sensitive action + step-up** | `src/platform/security/sensitive-action-provider.tsx` |
| Step-up dialog / helper | `src/platform/security/step-up-dialog.tsx`, `step-up.ts` |
| Read-only + mode indicators | `src/platform/security/read-only-notice.tsx`, `access-mode-indicator.tsx` |
| **Telemetry redaction** | `src/platform/telemetry/redact.ts` |
| **Backend-message leak stop**, field and reference copy | `src/platform/errors/user-message.ts` |
| Leak-safe `DataState` (lint-enforced) | `src/platform/components/data-state.tsx` |
| Translated `StatusPill` (lint-enforced) | `src/platform/components/status-pill.tsx` |
| Error toast with support reference | `src/platform/errors/error-toast.ts` |
| Support reference (request id) | `src/platform/components/error-reference.tsx` |
| **CSRF policy** | `src/platform/security/csrf-policy.ts` |
| **Response headers** (applied via `vite.config.ts`) | `src/platform/security/security-headers.ts` |

## Platform support

| Concern | Path |
|---|---|
| Client env schema | `src/platform/config/env.ts` |
| **Production config check** | `src/platform/config/server-config.ts` |
| Public API origin | `src/platform/config/api-base-url.ts` |
| Runtime config the server hands the browser (API origin, flags off) | `src/platform/config/public-config.ts` |
| **Module manifest type, registry** | `src/platform/modules/manifest.ts`, `registry.ts` |
| **Sidebar** (built from the manifests) | `src/platform/config/navigation.tsx` (`getNavGroups`, `useNavGroups`), `nav-groups.tsx` (the 8 groups) |
| Global `g` shortcuts | `src/platform/keyboard/shortcuts.ts` |
| Error taxonomy | `src/platform/errors/` |
| **Forms kit** (TanStack Form + `@qeetrix/ui` fields, server field errors) | `src/platform/forms/app-form.tsx` |
| Query client, 403 recapability | `src/platform/query/query-client.ts` |
| Query devtools plugin (dev only) | `src/platform/query/query-devtools.tsx` |
| Feature flags (declared in manifests; `CONSOLE_FLAGS_OFF`) | `src/platform/feature-flags/` |
| Page chrome | `src/platform/components/page-header.tsx` |

## Modules

18 under `src/modules/`, listed in `src/app/modules.ts`, each with an `index.ts` barrel, a
`manifest.tsx` and its `locales/`: `account` `activity` `authentication` `authorization` `billing`
`branding` `compliance` `dashboard` `developer` `directory` `groups` `onboarding` `organizations`
`qeetai` `search` `security` `timeline` `users`. A module with screens has a `pages.ts` (what
routes render), `routes/` and an `api/keys.ts` query-key factory. A new one:
`bun run new-module <id>` (`scripts/new-module.mjs`). Details: [`subsystems.md`](subsystems.md).

## Shared

`src/shared/components/` (incl. `data-table/`, `confirm-dialog.tsx`, `one-time-secret.tsx`),
`src/shared/hooks/`, `src/shared/utils/` (incl. `search-params.ts`, the route search-schema
helpers), `src/shared/data/` (`regions.ts`, `team-sizes.ts`).

## Conventions — reference implementation

`src/modules/users`: `api/keys.ts` (tenant-scoped key factory), `api/users.ts` (`userQueries`
built with `queryOptions`, hooks, mutations), `components/` (pages, sheets built on the forms kit),
`use-user-actions.ts` (the sensitive user actions), `pages.ts` (the pages, for routes only),
`manifest.tsx` (its sidebar entries, commands, shortcut, Qeet AI suggestions). Its routes under
`routes/app/users/` declare their capability, validate search params and render those pages; every
other route does the same.

## i18n

`src/i18n/` — setup and the platform's `common`/`errors`; every other namespace lives in its
module's `locales/<lng>/`. 8 locales with files, 1 offered. `en` has 27 namespaces; the others
have 10 (about 5% of the keys), so only English is offered until one is complete
(`OFFERED_LANGUAGES`, `src/i18n/README.md`).

## Build, test, CI

| | |
|---|---|
| Scripts | `package.json` |
| **Layering rules** | `biome.json` |
| Vite plugins, security-header route rules | `vite.config.ts` (dev port 3002 is set in the `dev` script) |
| Unit tests + coverage thresholds | `vitest.config.ts` — `environment: "node"`, jsdom via per-file pragma |
| CI (required check **Verify**) | `.github/workflows/ci.yml` |
| Static analysis | `.github/workflows/codeql.yml` |
| Known-vulnerability audit | `.github/workflows/dependency-audit.yml` (`bun run audit`) |
| Image build + smoke test on PRs | `.github/workflows/docker.yml` |
| Dependency updates | `.github/dependabot.yml`, `bunfig.toml` (3-day minimum release age) |
| Deploy | `.github/workflows/deploy.yml` + `vercel.json` |
| Container image | `Dockerfile` (health check on `/healthz`) |

> **`src/app/` is the composition root**, not a provider tree: it lists the modules and wires their
> routes, manifests and catalogues. Providers are composed in `__root.tsx` and the `_app` /
> `account` layouts.
