# Architecture Map — qeet-id-console

**Level:** L2 · **Last verified:** 2026-08-28
**Verification scope:** every path below was confirmed to exist.

| Need | Path |
|---|---|
| Repository identity | [`qeet-repo.yml`](../../qeet-repo.yml) |
| Agent instructions | [`AGENTS.md`](../../AGENTS.md) |
| Subsystem map + real paths | [`subsystems.md`](subsystems.md) |

## Entry points

| Concern | Path |
|---|---|
| Router construction | `src/router.tsx` |
| **Start instance: CSRF middleware + production config check** | `src/start.ts` |
| Generated route tree — **never hand-edit** | `src/routeTree.gen.ts` |
| Root layout, theme, toaster | `src/routes/__root.tsx` |
| Global styles | `src/styles.css` |
| Test polyfills | `src/test-setup.ts` |

## Route groups

| Group | Layout | Guard |
|---|---|---|
| `src/routes/_app/` | `src/routes/_app.tsx` | authenticated — redirects to `/sign-in` |
| `src/routes/_auth/` | `src/routes/_auth.tsx` | **reverse** — redirects away if signed in |
| `src/routes/account/` | `src/routes/account.tsx` | authenticated; end-user self-service, outside the admin shell |
| `src/routes/api/` | — | server-only SSE handlers |

## The BFF — the one path to the backend

| Concern | Path |
|---|---|
| **Browser entry — the ONLY request path** | `src/platform/api/client.ts` |
| **Server proxy, bearer attachment, refresh** | `src/platform/api/server-proxy.ts` |
| **SSRF guard** | `src/platform/api/server-request-policy.ts` |
| SSE proxying | `src/platform/api/server-stream.ts` |
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
| **Sensitive action + step-up** | `src/platform/security/sensitive-action-provider.tsx` |
| Step-up dialog / helper | `src/platform/security/step-up-dialog.tsx`, `step-up.ts` |
| Read-only + mode indicators | `src/platform/security/read-only-notice.tsx`, `access-mode-indicator.tsx` |
| **Telemetry redaction** | `src/platform/telemetry/redact.ts` |
| **Backend-message leak stop** | `src/platform/errors/user-message.ts` |
| Leak-safe `DataState` (lint-enforced) | `src/platform/components/data-state.tsx` |
| **CSRF policy** | `src/platform/security/csrf-policy.ts` |
| **Response headers** (applied via `vite.config.ts`) | `src/platform/security/security-headers.ts` |

## Platform support

| Concern | Path |
|---|---|
| Client env schema | `src/platform/config/env.ts` |
| **Production config check** | `src/platform/config/server-config.ts` |
| Public API origin | `src/platform/config/api-base-url.ts` |
| **Nav tree + path→capability map** | `src/platform/config/navigation.tsx` |
| Error taxonomy | `src/platform/errors/` |
| Query client, 403 recapability | `src/platform/query/query-client.ts` |
| Query devtools plugin (dev only) | `src/platform/query/query-devtools.tsx` |
| Feature flags | `src/platform/feature-flags/` |
| Page chrome | `src/platform/components/page-header.tsx` |

## Modules

17 under `src/modules/`, each with an `index.ts` barrel: `activity` `authentication`
`authorization` `billing` `branding` `compliance` `dashboard` `developer` `directory` `groups`
`onboarding` `organizations` `qeetai` `search` `security` `timeline` `users`.
Details and barrels: [`subsystems.md`](subsystems.md).

## Shared

`src/shared/components/` (incl. `data-table/`), `src/shared/hooks/`, `src/shared/utils/`,
`src/shared/data/regions.ts`.

## i18n

`src/i18n/` — 8 languages. `en` has 19 namespaces; the others have 10 (about 8% of the keys) and
fall back to `en`.

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

> **`src/app/` does not exist.** Providers are composed in `__root.tsx` and the `_app` / `account`
> layouts.
