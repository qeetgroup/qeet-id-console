# Repository Context — qeet-id-console

**Level:** L2 · **Status:** active · **Evidence state:** verified · **Last verified:** 2026-08-28
**Verification scope:** layering rules read from `biome.json`; session and BFF behaviour from
`src/platform/{api,auth}`; capability model from `src/platform/security/`; CI from
`.github/workflows/ci.yml`. Layer compliance verified by grep.

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
routes  →  modules  →  platform  →  shared
```

**Evidence:** `biome.json` `noRestrictedImports` overrides, plus `noImportCycles: "error"`.
Run by CI as `bun run lint:boundaries`.

| Layer | May import |
|---|---|
| `src/shared/**` | `@/shared`, `@/i18n`, external packages only |
| `src/platform/**` | `@/platform`, `@/shared`, `@/i18n` |
| `src/modules/**` | the above, **plus another module only via its barrel** `@/modules/<name>` |
| `src/routes/**` | module barrels and `pages` entries, `@/platform/**` (except `api` from the client), `@/shared/**`; not module internals, `api()` or `@tanstack/react-query`. No route is exempt |

`@/lib` is **retired** — importing it is a lint error.

**Verified compliance:** 0 cross-module-internal imports, 0 `platform → modules`, 0 `shared → up`.
Every route file follows the route rule: `createFileRoute`, its guards, a Zod search schema and the
page from the owning module's `pages.ts`. The pages, their data and their forms live in the modules.

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
  shares one backend call per refresh token spent, and keeps a successful result for 30 s while
  the token it issued is unspent: a request aborted mid-refresh (the browser navigated) never
  delivered its new cookie, so the next request arrives with the rotated token and reuses the
  result instead of being refused. The cache is per process; another instance gets the same pair
  from the backend's reuse grace (`REFRESH_TOKEN_REUSE_GRACE`, default 30 s), under the same rule.
- **Replay**: on a backend 401, `proxyApiRequest` renews the session itself (it holds the refresh
  token) and re-issues once with the **same** `requestId` — this is what keeps server-side renders
  from ending a valid session. A rejected refresh token clears the cookie (the browser then goes to
  `/sign-in`); an unreachable backend answers a retryable 503 and keeps the session.

Multi-tab clients must serialise refresh or they trigger the backend's own theft detection.

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
> `qeet-id-server` enforces RBAC and tenant isolation in its application layer — there is **no
> Postgres RLS** (`qeet-id-context/DRIFT-REGISTER.md` **QID-002**). Do not claim RLS.

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
- **`src/platform/telemetry/redact.ts`** — denylist regex (token, authorization, secret, password,
  refresh, client_secret, private_key, api-key, otp, recovery, cookie, credential, ssn) plus
  email → `[redacted-email]` and IPv4 → `[redacted-ip]`.
- Opt-in runtime schemas: a mismatch throws `client.schema_mismatch` — fail closed.

## Routing

File-based via `tanstackStart()`. `src/routeTree.gen.ts` is **generated, committed and read-only**.
Four groups — `_app` (authenticated shell), `_auth` (reverse guard), `account` (end-user
self-service, deliberately outside the admin shell), `api` (server-only SSE).

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
refresh, cross-site write rejection, cross-tab logout, single-flight refresh, an organization switch
that moves every tab and stops reading the old organization's data, and two concurrent
sessions kept apart. They run against the **production build** and a fake backend
(`tests/e2e/fixtures/fake-backend.mjs`) and wait for `<html data-hydrated>` before typing — the
earlier suite ran against `vite dev`, raced hydration and on-demand compiles, and was removed for
flaking. No retries: a flake is a bug. Run them after any change to `src/platform/{api,auth}`.

Every module has tests; `users`, `security`, `compliance` and `authorization` pin their request
contracts, cache refreshes and tenant guards.

## CI/CD

`ci.yml` job `verify` (name **Verify**, the required check on `main`), 20-minute timeout:
checkout → bun 1.3.14 → `install --frozen-lockfile` → `typecheck` → `check` →
**`lint:boundaries`** → `test:coverage` → `build`. A `dependency-review` job runs on pull requests;
`release/**` pushes also publish the test-kit image. `codeql.yml` scans TypeScript and the
workflows. Actions are pinned to commit SHAs; workflows default to read-only permissions.

`deploy.yml` deploys production on every push to `main` (same gate, `vercel build`/`deploy --prod`,
then the version tag and GitHub release). Vercel's Git integration is off for `main` and still builds
PR and `develop` previews. Dependabot (`.github/dependabot.yml`) and `bunfig.toml` both hold new
releases back for 3 days. `dependency-audit.yml` runs `bun run audit` (high and critical) on pushes,
PRs and daily; it is not a required check, so a newly published advisory shows red without blocking
merges. `docker.yml` builds and smoke-tests the image on PRs that touch it.

**Dependency overrides** (`package.json` `overrides`) hold only security floors: transitive packages
pinned at or above their first patched release because a parent still allowed a vulnerable one. Remove
an entry once every parent requires a fixed version. The single audit ignore (`braces`, no fixed
release; reached only through the `shadcn` CLI in `@qeetrix/ui`) is documented in
`dependency-audit.yml` and goes when QTRX-4 lands.

## Security-critical areas

| Area | Path | Risk | Review |
|---|---|---|---|
| Session cookie, sealing | `src/platform/auth/server-session.ts` | **Critical** | Security review |
| Bearer attachment, refresh | `src/platform/api/server-proxy.ts` | **Critical** | Security review |
| SSRF guard | `src/platform/api/server-request-policy.ts` | **Critical** | Security review |
| Token-issuing allowlist | `src/platform/auth/session-response.ts` | **Critical** | Security review |
| Capability model | `src/platform/security/` | High | Review — UX only, never enforcement |
| Telemetry redaction | `src/platform/telemetry/redact.ts` | High | Security review |
| Error copy | `src/platform/errors/user-message.ts` | High | Review — leak stop |
| CSRF middleware, production config check | `src/start.ts`, `src/platform/config/server-config.ts` | High | Security review |
| Per-person browser storage | `src/platform/auth/scoped-storage.ts` | High | Security review |
| Response headers | `src/platform/security/security-headers.ts` | High | Security review |

## Known constraints

- **The dev port is pinned to 3002.** `qeet-id-server` expects the console on **3002**
  (`APP_BASE_URL`) for redirects and passkeys, so the `dev` script hardcodes `--port 3002`.
- **Icons come only from `@qeetrix/icons`** (`lucide-react` is not a dependency). Type an "any icon"
  prop as `ComponentType<IconProps<"outline">>`, not `typeof SomeIcon`: icons with a filled drawing
  have a wider props type.
- ~25k LOC in `src/routes` despite the "composition only" rule (being migrated into modules).
- Biome warnings fail CI (`--error-on-warnings`): fix them, or suppress one with a specific reason.
- TypeScript runs with `strict` plus `noUncheckedIndexedAccess`, `noImplicitReturns` and
  `noImplicitOverride`. Narrow an indexed value with a guard; `!` is a lint error.
- `@qeetrix/ui`'s root import is slow to load in tests (each jsdom file pays it); the fix belongs in
  `qeetrix` (QTRX-5). Its `DataState` prints `error.message` by default (QTRX-3), hence the platform
  wrapper.

## Known documentation drift

| Claim | Reality |
|---|---|
| "RBAC + Postgres RLS" (older product docs) | **No RLS exists** — QID-002, critical; Qeet ID enforces tenancy in the application layer |

Product-level drift lives in `qeet-id-context/DRIFT-REGISTER.md`; this table is repository-local.

## Documentation authority

Source > tests > `biome.json` (the layering rules are executable) > `docs/llm/*` > README. The **API contract** is owned by `qeet-id-server`.
