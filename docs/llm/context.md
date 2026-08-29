# Repository Context — qeet-id-console

**Level:** L2 · **Status:** active · **Evidence state:** verified · **Last verified:** 2026-08-28
**Verification scope:** layering rules read from `biome.json`; session and BFF behaviour from
`src/platform/{api,auth}`; capability model from `src/platform/security/`; CI from
`.github/workflows/ci.yml`. Layer compliance verified by grep.

## Identity

The **operator console for Qeet ID**, served at `console.id.qeet.in`. TanStack Start ^1.168 +
TanStack Router ^1.170, React 19, Vite 8 + Nitro, Tailwind v4, `@qeetrix/ui`, bun 1.3.14.
~65k LOC, 550 tracked files, 14 modules.

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
| `src/routes/**` | anything below (the module override applies only under `src/modules/**`) |

`@/lib` is **retired** — importing it is a lint error.

**Verified compliance:** 0 cross-module-internal imports, 0 `platform → modules`, 0 `shared → up`.
`src/routes` imports module internals 167 times, which is permitted.

> The lint messages still say **"features/"** — stale wording from before the rename to `modules/`.
> The rule is correct; only the message is dated.

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
- **Server**: `refreshServerSessionNow` rejects stale callers on version mismatch; `refreshSession`
  single-flights in-process via a `Map` keyed on session/refresh token.
- **Replay**: on 401, refresh once and re-issue with the **same** `requestId`. A final 401 clears
  the cookie and redirects to `/sign-in`.

Multi-tab clients must serialise refresh or they trigger the backend's own theft detection.

### Token containment — ADR-0009

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
superseded ADR-0002 model. Do not reintroduce them.

## Authorization — UX only

**Evidence:** `src/platform/security/`, ADR-0003

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

> ADR-0003 is titled *"Backend-authoritative authorization; client capabilities are UX-only"*:
> *"Never re-implement RBAC/ABAC evaluation on the client."*
>
> **Caveat:** ADR-0003 and ADR-0009 both describe the backend as "RBAC + Postgres **RLS**".
> `qeet-id-server` has **no RLS** — isolation is application-layer. Recorded as
> `qeet-id-context/DRIFT-REGISTER.md` **QID-002 (critical)**. The RBAC half is right; do not repeat
> the RLS claim.

Any 403 triggers `refreshCapabilities()` — invalidating the capability query — so a permission change
elsewhere self-heals.

## Sensitive actions and step-up — ADR-0005

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
- Opt-in runtime schemas (ADR-0007): a mismatch throws `client.schema_mismatch` — fail closed.

## Routing

File-based via `tanstackStart()`. `src/routeTree.gen.ts` is **generated, committed and read-only**.
Four groups — `_app` (authenticated shell), `_auth` (reverse guard), `account` (end-user
self-service, deliberately outside the admin shell), `api` (server-only SSE).

CSRF is applied in `src/start.ts` for all server functions and all non-GET/HEAD/OPTIONS requests.

## Testing

29 unit test files, Vitest only. It defaults to `environment: "node"`; seven files opt into jsdom
with a `// @vitest-environment jsdom` pragma. `vitest.config.ts` deliberately does **not** reuse
`vite.config.ts` — unit tests stay independent of Start/Nitro plugins.

**There is no browser-level test cover.** The Playwright session-boundary suite was removed in
2026-08 after persistent CI flake. Nothing now automatically verifies the ADR-0009 invariants that
only appear in a real browser: absence of localStorage tokens, HttpOnly + `SameSite=Lax` cookie
flags, cross-origin BFF rejection (the CSRF middleware in `src/start.ts` has **no** test at all),
cross-tab logout, and single-flighted refresh. Verify these by hand when touching
`src/platform/{api,auth}`.

**No tests** for `billing`, `compliance`, `developer`, `onboarding`, `organizations`, `users`,
`authorization`, or `src/routes/**`.

## CI/CD

`ci.yml`, one job `verify` on `ubuntu-latest`, 15-minute timeout:
checkout → bun 1.3.14 → `install --frozen-lockfile` → `typecheck` → `check` →
**`lint:boundaries`** → `test` → `build`.

No deploy workflow — Vercel deploys from its own Git integration (`vercel.json` pins the install and
build commands).

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
| CSRF middleware | `src/start.ts` | High | Security review |

## Known constraints

- **No dev port is configured.** `vite dev` defaults to 5173, but `qeet-id-server` expects the
  console on **3002** (`APP_BASE_URL`) for redirects and passkeys. Use `--port 3002`.
- **`@qeetrix/ui ^1.0.3` is a major version behind** npm's `2.0.0`; `^1.x` will never resolve to it.
- 25k LOC in `src/routes` despite the "composition only" rule.
- Two modules have no barrel, so they cannot be imported by another module.
- Seven modules and all routes have no tests.
- Non-`error` Biome rules (`useExhaustiveDependencies`, `noArrayIndexKey`, a11y,
  `noDangerouslySetInnerHtml`) are **warnings** and do not fail `--diagnostic-level=error`.

## Known documentation drift

| Claim | Reality |
|---|---|
| README + `docs/architecture/target-architecture.md` describe `src/app/` | **`src/app/` does not exist** |
| README cites `features/dashboard/components/...` | The real path is under `src/modules/dashboard/components/` |
| Biome messages say "features/" | The layer was renamed to `modules/` |
| ADR-0003 cites "runtime-validated (ADR-0006)" | The runtime-schema ADR is **0007** |
| ADR-0003 / ADR-0009 say "RBAC + Postgres RLS" | **No RLS exists** — QID-002, critical |
| `project.tree` lists `.cta.json`, `.cursorrules`, `.dockerignore` | None exist; the file is stale |

Product-level drift lives in `qeet-id-context/DRIFT-REGISTER.md`; this table is repository-local.

## Documentation authority

Source > tests > `biome.json` (the layering rules are executable) > ADRs >
`docs/engineering-standards.md` > README. The **API contract** is owned by `qeet-id-server`.
