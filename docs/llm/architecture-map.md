# Architecture Map — qeet-id-console

**Level:** L2 · **Last verified:** 2026-08-28
**Verification scope:** every path below was confirmed to exist.

| Need | Path |
|---|---|
| Repository identity | [`qeet-repo.yml`](../../qeet-repo.yml) |
| Agent instructions | [`AGENTS.md`](../../AGENTS.md) |
| Subsystem map + real paths | [`subsystems.md`](subsystems.md) |
| 42 numbered conventions | `docs/engineering-standards.md` |
| Nine ADRs | `docs/adr/` |

## Entry points

| Concern | Path |
|---|---|
| Router construction | `src/router.tsx` |
| **CSRF middleware, Start instance** | `src/start.ts` |
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
| Client session store, cross-tab | `src/platform/auth/session-store.ts` |
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

## Platform support

| Concern | Path |
|---|---|
| Env schema | `src/platform/config/env.ts` |
| Public API origin | `src/platform/config/api-base-url.ts` |
| **Nav tree + path→capability map** | `src/platform/config/navigation.tsx` |
| Error taxonomy | `src/platform/errors/` |
| Query client, 403 recapability | `src/platform/query/query-client.ts` |
| Feature flags | `src/platform/feature-flags/` |
| Page chrome | `src/platform/components/page-header.tsx` |

## Modules

14 under `src/modules/`: `activity` `authentication` `authorization` `billing` `compliance`
`dashboard` `developer` `onboarding` `organizations` `qeetai` `search` `security` `timeline` `users`.
Details and barrels: [`subsystems.md`](subsystems.md).

## Shared

`src/shared/components/` (incl. `data-table/`), `src/shared/hooks/`, `src/shared/utils/`,
`src/shared/data/regions.ts`.

## i18n

`src/i18n/` — 8 languages. `en` has 20 namespaces; the others have 10 and fall back to `en`.

## Build, test, CI

| | |
|---|---|
| Scripts | `package.json` |
| **Layering rules** | `biome.json` |
| Vite plugins | `vite.config.ts` — **no `server.port`** |
| Unit tests | `vitest.config.ts` — `environment: "node"`, jsdom via per-file pragma |
| CI | `.github/workflows/ci.yml` |
| Deploy | `.github/workflows/deploy.yml` + `vercel.json` |

## Architecture docs

`docs/architecture/current-state.md` · `target-architecture.md` · `audit-2026-08.md` ·
`enterprise-modernization-plan.md`

> **`src/app/` does not exist**, though the README and `docs/architecture/target-architecture.md`
> both reference it. See [context.md](context.md#known-documentation-drift).
