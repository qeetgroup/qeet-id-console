# Repository Context — qeet-id-console

**Level:** L2 · **Status:** active · **Evidence state:** verified · **Last verified:** 2026-10-24
**Verification scope:** layering rules read from `biome.json`; session and BFF behaviour from
`src/platform/{api,auth}`; capability model from `src/platform/security/`; CI from
`.github/workflows/`. Layer compliance verified by grep.

## Identity

The **operator console for Qeet ID**, served at `console.id.qeet.in`. TanStack Start ^1.168 +
TanStack Router ^1.170, React 19, Vite 8 + Nitro, Tailwind v4, `@qeetrix/ui`, bun 1.3.14.
18 modules under `src/modules/`.

**It has a server side.** TanStack Start acts as a same-origin backend-for-frontend. That is the
single most important architectural fact here.

## Context inheritance

```text
qeet-context (L0)      organization standards
      ↓
qeet-id-context (L1)   product architecture
      ↓
qeet-id-server         the API contract AND all enforcement
      ↓
qeet-id-console (L2)   THIS DOCUMENT — how the console is built
```

## Responsibilities

Operator UI for tenants, users, groups, authentication, authorization, security, billing, developer
and AI-assistant surfaces · a same-origin BFF that holds the session · capability-driven navigation
and page gating · telemetry redaction · user-safe error copy.

## Non-responsibilities

**It enforces nothing.** Authorization, tenancy, token validation and every business rule belong to
`qeet-id-server`. It also does not own the hosted login (`qeet-id-login`), the SDKs, docs, or the
design system (`qeetrix-ui`).

## Layered architecture — enforced by lint

```text
app  →  modules  →  platform  →  shared
```

**Evidence:** `biome.json` `noRestrictedImports` overrides, plus `noImportCycles: "error"`, run by
CI as `bun run lint:boundaries`; `src/__tests__/module-boundaries.test.ts` holds the rules Biome
can't express (barrel-only imports between modules, no import climbing more than one folder).

| Layer | May import |
|---|---|
| `src/shared/**` | `@/shared`, `@/i18n`, external packages only |
| `src/platform/**` | `@/platform`, `@/shared`, `@/i18n` |
| `src/modules/**` | the above, **plus another module only via its barrel** `@/modules/<name>`; never `@/app` or `@/routes` |
| route files (`src/modules/*/routes/**`, `src/routes/**`) | module barrels and `pages` entries, `@/platform/**` (except `api` from the client), `@/shared/**`; not module internals, `api()` or `@tanstack/react-query`. No route is exempt |
| `src/app/**` | anything — it is the composition root |

`@/lib` is **retired** — importing it is a lint error.

**Verified compliance:** 0 cross-module-internal imports, 0 `platform → modules`, 0 `shared → up`.
Every route file follows the route rule: `createFileRoute`, `staticData: { capability }`, its guards,
a Zod search schema and the page from the owning module's `pages.ts`. The pages, their data and
their forms live in the modules.

Global `fetch`, `EventSource`, `WebSocket` and `XMLHttpRequest` are lint errors outside
`src/platform/api/`; the activity and Qeet AI streams use its shared transport
(`event-stream.ts`).

## The BFF — how a request reaches the backend

```text
browser
  ↓  api(path, opts)                     src/platform/api/client.ts
  ↓    pre-emptive refresh if expiring within 60s
  ↓  proxyApiRequest  (server function)  src/platform/api/server-proxy.ts
  ↓    Zod-validates the path; sets Cache-Control: no-store, Vary: Cookie
  ↓    buildBackendUrl  →  SSRF guard    src/platform/api/server-request-policy.ts
  ↓    Authorization: Bearer <accessToken>   ← attached HERE, server-side only
  ↓    X-Request-Id
api.id.qeet.in
```

**`src/platform/api/client.ts` is the only place requests leave the app.** Correlation IDs, opt-in
schema parsing and telemetry live there so every caller inherits them.

The backend origin is `SERVER_URL ?? VITE_API_URL`, falling back to `http://localhost:4001` outside
production and **throwing in production** if unset. `VITE_API_URL` is used in the browser only for
unauthenticated federation redirects (e.g. starting a social login).

### The SSRF guard

`buildBackendUrl` re-checks the resolved URL and throws
*"Backend API path escaped its configured origin."* if origin, protocol or pathname changed.
**Never relax this.**

### Refresh — two coordinated layers

- **Client**: `navigator.locks.request("qeetid-session-refresh", …)` serialises tabs, sending
  `expectedVersion`.
- **Server**: `refreshServerSessionNow` rejects stale callers on version mismatch. `refreshSession`
  shares one backend call between concurrent refreshes of the same token. A request aborted
  mid-refresh (the browser navigated) never delivered its new cookie, so the next one arrives with
  the rotated token; the backend's reuse grace (`REFRESH_TOKEN_REUSE_GRACE`, default 30 s) answers
  it with the same pair while that pair's refresh token is unused.
- **Ended session**: a 401 `auth.session_revoked` (signed out everywhere, suspended, removed,
  password reset) is final. `proxyApiRequest` clears the cookie without trying a refresh, the
  browser client and `openEventStream` don't retry, and the signed-out session is broadcast, so
  other tabs go to `/sign-in` too.
- **Replay**: on a backend 401, `proxyApiRequest` renews the session itself (it holds the refresh
  token) and re-issues once with the **same** `requestId` — this is what keeps server-side renders
  from ending a valid session. A rejected refresh token clears the cookie (the browser then goes to
  `/sign-in`); an unreachable backend answers a retryable 503 and keeps the session.

Multi-tab clients must serialise refresh or they trigger the backend's own theft detection.

### Idle sign-out — one timer across tabs

`useIdleLogout` (10 minutes in the shell, `/account` and the organization selector) runs
`watchIdle` (`src/platform/auth/idle-activity.ts`). Each tab writes the time of its newest
activity to `localStorage` `qeetid.last-activity` — a bare timestamp, so unscoped — at most every
15 s with a trailing write, and never over a newer one. When a tab's timer fires it re-arms for
the newest activity in any tab and signs out only when that is older than the limit, so an idle
tab no longer signs out an operator working in another. The sign-out's `cleared` broadcast takes
every other tab to `/sign-in`. A timestamp in the future or unreadable is ignored; with storage
disabled each tab goes by its own activity. It is UX: the server's own idle limit stays
authoritative.

### Token containment

```ts
PublicSession = { isAuthenticated, expiresAt, sessionId, userId, tenantId,
                  version, impersonationActor }
```

**No tokens cross to the browser.** The pair lives in an encrypted, **chunked**
`__Host-qeet_console` cookie (`__chunked__<n>` plus `name.1..N`), `HttpOnly`, `SameSite=Lax`,
`Path=/`, 30-day max age. Unsealing failure **clears the session and returns `{}`** — fail closed.
`SESSION_SECRET` must be ≥32 chars; production refuses to start otherwise.

A **token-issuing allowlist** (`session-response.ts`) names the only endpoints permitted to return
credentials; tokens are stripped from the browser-bound JSON. A token-shaped response from any other
endpoint is refused with `502 client.unexpected_token_response`.

`session-store.ts` purges legacy `qeetid.access_token` / `refresh_token` keys at import — the
browser-held-token model the BFF replaced. Do not reintroduce them.

## Authorization — UX only

**Evidence:** `src/platform/security/`

```text
GET /v1/users/{userId}/tenants/{tenantId}/permissions
   ↓  Zod-validated — "Parsing fails CLOSED"
25 CONSOLE_CAPABILITIES  →  classifyAccessMode
   ↓
can / canAll / canAny / canAccessPath   — gated on state === "ready"
   ↓
AccessBoundary gates the page; navigation is filtered
```

**Nothing is granted while resolving or errored.** A 403 on the capability query itself sets
`state = "error"`, `mode = "unknown"`.

> The rule: authorization is backend-authoritative; client capabilities are UX only. Never
> re-implement RBAC/ABAC evaluation on the client.
>
> `qeet-id-server` enforces RBAC in its application layer and tenant isolation in both the
> application and the database: since its 1.0.0 migration 0160, Postgres row-level security
> (`tenant_isolation`) covers the organization-owned tables, with connections scoped to the
> request's tenant. None of it is visible to, or replaceable by, the console.

Any 403 triggers `refreshCapabilities()` — invalidating the capability query — so a permission change
elsewhere self-heals.

## Sensitive actions and step-up

`useSensitiveAction()` is the one path: capability pre-check (UX) → confirm → step-up → retry once.
A backend `403 step_up_required` opens the re-auth dialog instead of dead-ending in a toast.
`RequireRecentMFA` on the backend stays authoritative. The generic 403 toast is deliberately
suppressed for step-up.

## Errors and telemetry

- **`src/platform/errors/user-message.ts` is "the leak stop"** — backend `error.message`/`detail` may
  carry internal context and must **never** be rendered. Map a code to safe copy.
- **`src/platform/telemetry/redact.ts`** — the one redaction step for everything that leaves as
  telemetry. Values under a denylisted key (token, authorization, secret, password, refresh,
  client_secret, private_key, api-key, otp, recovery, cookie, credential, ssn) become `[redacted]`;
  inside strings, JWTs, `Bearer`/`Basic` credentials and long opaque runs (a 43-character refresh
  token, a hex hash; a bare UUID is kept) become `[redacted-token]`, a URL's query string
  `?[redacted-query]`, emails `[redacted-email]` and IPv4 addresses `[redacted-ip]`.
- Opt-in runtime schemas: a mismatch throws `client.schema_mismatch` — fail closed.

Nothing goes to a third party. Production telemetry is the console's own server log:

- **Server log** (`telemetry/server-log.ts`) — one JSON line per event on stdout (Vercel and the
  container both collect it): `{ ts, level, event, …fields }`, every field passed through
  `redact()`. It writes only in a production build (`import.meta.env.PROD`); DEV keeps its console
  output (`logger`, the `api →` trace), and a test run is silent unless a test installs a sink
  (`_setServerLogSinkForTest`). It imports `@tanstack/react-start/server-only`, so `vite build`
  fails ("Import denied in client environment") if any of it would reach the browser bundle: call
  it only from server-function handlers, server routes, `createServerOnlyFn`, or modules only they
  import.
- **Events** — `api.request` per `proxyApiRequest` call (`api/server-proxy-log.ts`) and
  `api.stream` per SSE proxy (`api/server-stream.ts`): request id, method, the backend path as a
  template (`/v1/users/{id}/sessions`, `telemetry/path-template.ts`; never the query), status,
  `durationMs` and `outcome` (`ok`, `refreshed`, `refresh_rejected`, `backend_unavailable`,
  `session_ended`, `unexpected_token`; streams `ok`, `no_session`, `aborted`,
  `backend_unavailable`, `session_ended`, timed to the backend's answer). `session.refresh` for
  each renewal (`trigger`: `backend_401`, `browser_expiring`, `browser_forced`; `outcome`:
  `refreshed`, `rejected`, `unavailable`). `config.invalid` names the variables the production
  check in `src/start.ts` refused, never their values. Never a token, cookie, body or email.
- **Browser reports** (`telemetry/client-reporter.ts`, started in `src/router.tsx` before
  hydration, production builds only) — `window` `error` and `unhandledrejection`, `captureError`'s
  callers (the root error boundary, a failed sensitive action) and Web Vitals (`web-vitals`: LCP,
  INP, CLS, FCP, TTFB, one report per metric per page view). Each carries the route's template
  (`/users/$userId`), never its URL; an API error is reported by its code, never the backend's
  message; text is redacted, then cut to the server's bounds. At most 10 distinct messages per
  page load, deduplicated by message. Errors are sent after 2 s, everything when the page is
  hidden, in batches of up to 20, with a keepalive fetch (`api/keepalive-fetch.ts`). Reporting
  never throws into the app.
- **Report endpoint** (`telemetry/client-report.ts`) — the `reportClientTelemetry` server
  function, so the CSRF middleware checks it like any other. Zod strict objects: unknown fields,
  over-long text (message 500, stack 2000), more than 20 events or a route that isn't a path
  template are refused. It templates the route again and writes `client.error` / `client.vital`
  through the server log. It needs no session (sign-in pages report too), so a scripted client
  that forges `Origin` can add log lines; there is no rate limit.
- `captureError` still logs to the console in DEV only; server-side renders don't report through
  it.

## Modules and the shell

The platform never imports a module. `src/app/register.ts` loads every module's `manifest.tsx`
(`defineModule`, `src/platform/modules/manifest.ts`) into the registry
(`src/platform/modules/registry.ts`), and the shell reads its parts from there: sidebar entries
(`getNavGroups`), palette commands, `g` shortcuts, feature flags. A module offers its own extension
point by augmenting `ModuleExtensions` (Qeet AI's `qeetaiSuggestions`), and other modules fill it
in their manifests. Adding a module therefore touches its own folder and one line,
`src/app/modules.ts`; `bun run new-module <id>` writes both.

**Feature flags** are declared in manifests with an owner, a description and an expiry (`null` only
for a lasting kill switch; a test fails once a date passes). `CONSOLE_FLAGS_OFF=<id>,…` turns any
off at runtime: the server reads it and hands it to the browser with the API origin
(`public-config.ts`), so no rebuild is needed.

## Routing

File-based via `tanstackStart()`, from a virtual config: `src/app/routes.ts` mounts the shell
(`src/routes`: `__root`, `_app`, `healthz`, `api/` for server-only SSE) and every module's
`routes/public/` at the root and `routes/app/` inside `_app`. `src/routeTree.gen.ts` is
**generated, committed and read-only**. The groups: `_app` (authenticated shell), `_auth`
(reverse guard, `authentication`), `account` (end-user self-service, deliberately outside the
admin shell), `api`.

Each route declares its page's capability as `staticData: { capability }`; the router registers
them (`route-capability.ts`), and the access boundary and link checks resolve a path against them —
the whole path first, else the deepest route matching a leading part.

CSRF is applied in `src/start.ts` for all server functions and all non-GET/HEAD/OPTIONS requests.

## Testing

Vitest only. It defaults to `environment: "node"`; component and browser-storage tests opt into
jsdom with a `// @vitest-environment jsdom` pragma. `vitest.config.ts` deliberately does **not**
reuse `vite.config.ts` — unit tests stay independent of Start/Nitro plugins. `bun run
test:coverage` (what CI runs) enforces the coverage thresholds in `vitest.config.ts`: a floor for
`src/**` and higher floors for `src/platform/{api,auth,security}`. Thresholds only go up.

**Browser tests** (`tests/e2e`, `bun run test:e2e`, CI job "Session E2E") cover the session-boundary
invariants that only appear in a real browser: anonymous guard, `__Host-` HttpOnly Secure
`SameSite=Lax` cookie, no token in Web Storage, `document.cookie` or server-rendered HTML, hard
refresh, cross-site write rejection, cross-tab logout, two tabs renewing an expired session with
one rotation, an organization switch that moves every tab and stops reading the old
organization's data, and two concurrent sessions kept apart. They run against the **production
build** and a fake backend (`tests/e2e/fixtures/fake-backend.mjs`, which rotates refresh tokens with
the server's reuse grace, so a request that misses a shared refresh behaves as in production) and
wait for `<html data-hydrated>` before typing — the
earlier suite ran against `vite dev`, raced hydration and on-demand compiles, and was removed for
flaking. No retries: a flake is a bug. Run them after any change to `src/platform/{api,auth}`.

**Accessibility** (`tests/e2e/accessibility.spec.ts`, same job) holds the console to WCAG 2.2 AA:
axe (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) scans
sign-in, sign-up, verify-email, select-organization, the dashboard, users, a user's detail page,
groups, roles, the security and developer overviews, organization settings and the account profile,
each in the light and the dark theme (set as the theme toggle saves it, `qeetid-admin-theme` in
`localStorage`), and with the command palette, the invite sheet, a confirm dialog and the account
menu open. Each scan waits for hydration, the page's real content, no skeleton or `aria-busy`
region left and finished animations; any violation fails with its rule, elements and reason. The
fake backend serves the pages' records from `tests/e2e/fixtures/fake-tenant-data.mjs` and has an
`admin@example.com` with every capability (so actions render) and an `unverified@example.com`.
Text over the shell's and sidebar's faint gradients is measured against their solid token (axe
can't measure over a gradient). A violation from inside `@qeetrix/ui` is excused for that rule on
that element only (`DESIGN_SYSTEM_ISSUES` in the spec, AGENTS.md rule 12); today one, the
dark-theme destructive button in a confirm dialog. Ports default to 43173 and 43101;
`E2E_APP_PORT` and `E2E_BACKEND_PORT` override them.

Every module has tests; `users`, `security`, `compliance` and `authorization` pin their request
contracts, cache refreshes and tenant guards.

Timing logic runs on fake timers (`vi.useFakeTimers()`, which fakes `Date` too). The idle
sign-out tests (`src/platform/auth/__tests__/idle-activity*.test.ts*`) model each tab as its own
`EventTarget` over the one shared `localStorage`: activity in one tab keeps another signed in,
every tab idle signs out once, another tab's timestamp is honoured, and the node-environment
file holds it inert on the server.

## CI/CD

`ci.yml` job `verify` (name **Verify**, the required check on `main`), 20-minute timeout:
checkout → bun 1.3.14 → `install --frozen-lockfile` → `typecheck` → `check` →
**`lint:boundaries`** → `test:coverage` → `build` → **`size`**. `size`
(`scripts/check-bundle-size.mjs`) reads TanStack Start's route manifest from the server build,
follows each route's static imports through `.output/public/assets`, and fails when the signed-in
shell's initial JS (the root plus `/_app`) or a route's own JS beyond its parent's exceeds its gzip
budget in `bundle-budgets.json`, or when a budget names a route that no longer exists; an unlisted
route is held to `newRoute`. A `dependency-review` job runs on pull requests;
`release/**` pushes also publish the test-kit image. `codeql.yml` scans TypeScript and the
workflows. Actions are pinned to commit SHAs; workflows default to read-only permissions.

`deploy.yml` deploys production on every push to `main` (same gate, `vercel build`/`deploy --prod`,
then the version tag and GitHub release). Vercel's Git integration is off for `main` and still builds
PR and `develop` previews. Dependabot (`.github/dependabot.yml`) and `bunfig.toml` both hold new
releases back for 3 days. `dependency-audit.yml` runs `bun run audit` (high and critical) on pushes,
PRs and daily; it is not a required check, so a newly published advisory shows red without blocking
merges. `docker.yml` builds and smoke-tests the image on PRs that touch it.

**TanStack Start is pinned at 1.168.61** (with `@tanstack/react-router` 1.170.42, the version it
requires): Start 1.169 removed the built-in `useSession` API that `src/platform/auth/server-session.ts`
seals the session cookie with. Moving past it means choosing a session library and migrating the
cookie (or signing everyone in again), a security-reviewed change of its own; until then, don't
bump these two.

**SBOM and provenance.** `sbom.yml` (reusable, read-only) installs with `--ignore-scripts` and runs
a pinned `npx @cyclonedx/cyclonedx-npm --omit dev`: `npm ls` reads bun's hoisted `node_modules`, so
the CycloneDX file lists the production dependency tree as `bun.lock` resolves it (artifact
`sbom`). `deploy.yml` (`sbom`, `attest`), the release-image path of `ci.yml` (`image-sbom`,
`image-attest`) and `docker.yml` (PRs, generation only) call it. The attest jobs sign with
`actions/attest`: SLSA build provenance, plus the SBOM as a `https://cyclonedx.org/bom`
attestation, for the image's index digest and for `vercel-output.sha256`, the checksums of every
file in `.vercel/output` (that output is built with the production environment, so only its
hashes are uploaded). Only these two jobs hold `id-token: write` and `attestations: write`, and
they run no checkout or dependency code. A failed SBOM still leaves the provenance. The SBOM keeps
its `serialNumber` (no `--output-reproducible`): `actions/attest` recognises CycloneDX by it.
Verification commands are in `AGENTS.md` ("What CI enforces").

**Dependency overrides** (`package.json` `overrides`) hold only security floors: transitive packages
pinned at or above their first patched release because a parent still allowed a vulnerable one. Remove
an entry once every parent requires a fixed version. The three audit ignores (`braces`, `zod` 3 and
`body-parser`) are all reached only through the `shadcn` CLI in `@qeetrix/ui`, which the console
never runs or bundles; they are documented in `dependency-audit.yml` and go when QTRX-4 lands.

## Security-critical areas

| Area | Path | Risk | Review |
|---|---|---|---|
| Session cookie, sealing | `src/platform/auth/server-session.ts` | **Critical** | Security review |
| Bearer attachment, refresh | `src/platform/api/server-proxy.ts` | **Critical** | Security review |
| SSRF guard | `src/platform/api/server-request-policy.ts` | **Critical** | Security review |
| Token-issuing allowlist | `src/platform/auth/session-response.ts` | **Critical** | Security review |
| Capability model | `src/platform/security/` | High | Review — UX only, never enforcement |
| Telemetry redaction, server log, browser report endpoint | `src/platform/telemetry/{redact,server-log,client-report}.ts` | High | Security review |
| Error copy | `src/platform/errors/user-message.ts` | High | Review — leak stop |
| CSRF middleware, production config check | `src/start.ts`, `src/platform/config/server-config.ts` | High | Security review |
| Per-person browser storage | `src/platform/auth/scoped-storage.ts` | High | Security review |
| Response headers | `src/platform/security/security-headers.ts` | High | Security review |
| Content-Security-Policy | `src/platform/security/content-security-policy.ts`, `src/start.ts` | High | Security review |

## Known constraints

- **The dev port is pinned to 3002.** `qeet-id-server` expects the console on **3002**
  (`APP_BASE_URL`) for redirects and passkeys, so the `dev` script hardcodes `--port 3002`.
- **Icons come only from `@qeetrix/icons`** (`lucide-react` is not a dependency). Type an "any icon"
  prop as `ComponentType<IconProps<"outline">>`, not `typeof SomeIcon`: icons with a filled drawing
  have a wider props type.
- Biome warnings fail CI (`--error-on-warnings`): fix them, or suppress one with a specific reason.
- TypeScript runs with `strict` plus `noUncheckedIndexedAccess`, `noImplicitReturns` and
  `noImplicitOverride`. Narrow an indexed value with a guard; `!` is a lint error.
- `@qeetrix/ui`'s root import is slow to load in tests (each jsdom file pays it); the fix belongs in
  `qeetrix` (QTRX-5). Its `DataState` prints `error.message` by default (QTRX-3), hence the platform
  wrapper.

## Known documentation drift

| Claim | Reality |
|---|---|
| "No Postgres RLS" (QID-002, and this file before 2026-10-24) | **RLS exists** since `qeet-id-server` 1.0.0 (migration 0160, commit ea57c1f): a `tenant_isolation` policy on the organization-owned tables, alongside the application-layer checks |

Product-level drift lives in `qeet-id-context/DRIFT-REGISTER.md`; this table is repository-local.

## Documentation authority

Source > tests > `biome.json` (the layering rules are executable) > `docs/llm/*` > README. The **API contract** is owned by `qeet-id-server`.
