# Qeet ID Console Enterprise Modernization Plan

**Status:** Proposed  
**Date:** 2026-08-16  
**Scope:** `qeet-id-console`, with critical dependencies on `qeet-id-server` for the Phase 1
session contract and on deployment/SRE for browser security headers and release controls  
**Audience:** Frontend, identity platform, security, SRE, and engineering leadership

## 1. Executive summary

Qeet ID Console already has a credible architectural foundation: strict TypeScript, a documented
layer model, enforced import restrictions, a canonical HTTP client, backend-authoritative
capabilities, normalized errors, request correlation, and focused tests around several critical
primitives. The repository does not need another folder rewrite or a framework change.

The remaining gap is between **structural architecture** and **runtime guarantees**. The source tree
looks layered, but authentication is still browser-owned, session transitions are not atomic across
tabs, tenant-scoped state is inconsistently partitioned, most API responses are trusted casts,
sensitive mutations do not consistently use the step-up workflow, route files still own substantial
business logic, and production observability and quality gates remain incomplete.

The recommended strategy is incremental:

1. Contain the current security and tenant-isolation risks without changing the auth protocol.
2. Replace browser bearer-token ownership with an SSR-compatible cookie/BFF session boundary.
3. Standardize transport, query keys, runtime contracts, errors, and sensitive actions.
4. Move workflows from routes into capability modules one vertical slice at a time.
5. Make E2E, accessibility, observability, supply-chain, and performance controls release gates.

This is a hardening and completion program, not a rewrite.

## 2. Audit baseline

The following baseline was verified on 2026-08-16. Counts were produced with `find`, `rg`, and
`wc`; the exact inclusion rules and reproduction commands are recorded in Appendix A.

| Measure | Current state |
|---|---:|
| Production TypeScript/TSX, excluding tests and generated route tree | 381 files / 59,449 lines |
| Route layer | 99 files / 25,353 lines, about 42.6% of production TS/TSX |
| Route files directly using React Query operations | 30 |
| Unit/component test files | 25 |
| Passing tests | 208 |
| Mutating request declarations (`POST`, `PUT`, `PATCH`, `DELETE`) | 201 across 77 files |
| Production files consuming `useSensitiveAction` | 10 |
| API responses using the `schema` runtime-validation option | 1 |
| Executable network paths | 4: canonical API, refresh, activity SSE, Qeet AI SSE |
| Route E2E, accessibility, and contract suites | 0 |

Current gates pass:

- `bun run typecheck`
- `bun run check`
- `bun run lint:boundaries`
- `bun run test`
- `bun run build`

Passing gates show that the current code is internally consistent. They do not yet prove tenant
isolation, browser-session safety, accessibility, backend contract compatibility, or critical user
journeys.

## 3. What should be preserved

The following are sound and should be extended rather than replaced:

- The dependency direction `routes -> modules -> platform -> shared`.
- Biome restrictions for layer boundaries and import cycles.
- TanStack Start, Router, Query, Form, Store, and Table as the application platform.
- React 19 and the React Compiler.
- `@qeetrix/ui` as the primitive/design-system owner.
- The canonical `platform/api/client.ts` request behavior.
- Backend-authoritative RBAC/RLS with frontend capabilities used only for UX.
- `AccessBoundary`, `SensitiveActionProvider`, and the fail-closed capability schema.
- Error normalization and curated user-facing error messages.
- Telemetry redaction and request ID generation.
- Feature-local ownership under `modules/`.
- Existing route URLs and product behavior during refactoring.

## 4. Architecture findings

### A1. Browser-owned authentication is the primary architectural risk

**Severity:** High  
**Evidence:** `platform/auth/token-store.ts`, `platform/auth/session.ts`, `routes/_app.tsx`,
`routes/_auth.tsx`, `routes/account.tsx`, ADR-0002

Access and refresh tokens are readable from `localStorage`. Protected routes redirect in a
post-render effect because SSR cannot see the session. This creates four consequences:

- any same-origin script compromise can exfiltrate a full administrative session;
- SSR cannot make an authenticated routing or data-loading decision;
- protected UI can begin rendering before the redirect decision;
- idle logout is mounted in the admin shell but not consistently at the global session boundary.

ADR-0002 accepts client-side token storage only as a transitional decision with an explicit tracked
follow-up to move to `HttpOnly` cookies. It names CSP as a current mitigation, but the repository
deployment configuration does not define CSP or other browser security headers. The root document
also requires an inline theme script, so an enforced CSP needs a nonce or stable hash.

**Target:** The browser owns an opaque, `HttpOnly`, `Secure`, `SameSite` session cookie, never access
or refresh tokens. TanStack Start resolves the session before protected routes render.

### A2. Logout, refresh, and tenant switching are not one atomic lifecycle

**Severity:** High  
**Evidence:** `platform/auth/refresh.ts`, `platform/auth/token-store.ts`,
`platform/auth/session.ts`, `modules/authentication/api/flows.ts`

Refresh single-flight is limited to one JavaScript context. Explicit same-tab logout clears the
QueryClient, while a storage event in another tab only notifies selected token-store subscribers.
Tenant switching updates one tab and reloads it. Persisted module state uses separate cleanup and
rehydration mechanisms.

This can produce refresh-token races, stale protected views in another tab, and old-tenant cache or
persisted state after a session transition.

**Target:** One session coordinator publishes versioned `login`, `refresh`, `tenantChanged`,
`logout`, and `authLost` events through `BroadcastChannel` with a storage-event fallback. Every
transition clears or rekeys Query state and session-scoped persistence before new data can render.
The supported-browser decision in Section 8 determines which fallback paths must be tested; no
legacy browser is implied by the use of the fallback.

### A3. Qeet AI persistence can cross tenant and secret boundaries

**Severity:** High  
**Evidence:** `modules/qeetai/store/conversation-store.ts`, `modules/qeetai/redact.ts`,
`modules/qeetai/tools/execution-engine.ts`, `modules/qeetai/tools/definitions/user.tools.ts`

Conversation persistence uses one global storage key. Email and IP masking exists, and secret
artifacts are correctly diverted to memory, but arbitrary secret-keyed inputs are not denied. A tool
can accept a plaintext password, and execution failures can retain raw `Error.message` values that
are shown, sent back into model context, or persisted.

**Target:** Persisted/model-bound AI data passes through the same key-aware denylist as telemetry,
is partitioned by user and tenant, has an explicit retention policy, and never stores raw transport
or backend errors. Sensitive tool input fields are omitted rather than masked.

### A4. Sensitive-action behavior is only partially adopted

**Severity:** High for security workflows; Medium overall  
**Evidence:** ADR-0005, `platform/security/sensitive-action-provider.tsx`,
`routes/_app/users/index.tsx`, and the mutating request inventory

The shared capability/confirm/step-up/retry primitive is well designed, but only ten production files
consume it while the application declares 201 mutating requests. Not every mutation is sensitive,
but high-risk operations still use local confirm dialogs or direct mutations. The users route, for
example, owns password changes, MFA resets, session revocation, suspension, and deletion outside the
unified workflow.

**Target:** Maintain a reviewed mutation classification. Every action marked `sensitive` or
`destructive` must declare its capability, confirmation policy, step-up behavior, audit event, and
cache invalidation in one module-owned action definition.

### A5. The single-transport claim is not yet true

**Severity:** Medium  
**Evidence:** `platform/api/client.ts`, `platform/auth/refresh.ts`,
`modules/activity/activity-stream.ts`, `modules/qeetai/ai/streaming-client.ts`

Four executable fetch paths implement different subsets of correlation, refresh, validation, and
error normalization. Activity SSE reconnects after authentication failure without refreshing. Qeet
AI SSE emits backend error messages directly and does not share refresh behavior.

**Target:** One platform transport family owns JSON requests and authenticated streams. It provides
correlation, auth/session behavior, cancellation, safe error envelopes, schema parsing, retry policy,
and telemetry. Biome should reject direct `fetch` outside this platform boundary.

### A6. Runtime contracts and tenant-aware query identity are immature

**Severity:** Medium  
**Evidence:** ADR-0007, `platform/api/client.ts`, `platform/security/effective-permissions.ts`,
`modules/developer/api/signing-keys.ts`, `modules/qeetai/api/qeetai.ts`

Only effective permissions use runtime response validation. Most calls cast untrusted JSON to a
TypeScript interface. Query keys are usually raw arrays; several tenant-sensitive resources omit the
tenant, while broad invalidations rely on string prefixes.

**Target:** Module-owned query option/key factories always include scope. Security-critical and
write-response contracts use Zod immediately; remaining contracts migrate from a backend API schema.
Contract drift fails safely and emits a support-visible correlation ID.

### A7. Routes remain workflow owners

**Severity:** Medium  
**Evidence:** 30 route files directly use React Query; `routes/_app/users/index.tsx` is 1,082 lines

Routes commonly own queries, mutations, forms, filtering, optimistic updates, authorization checks,
and dialogs. That conflicts with the documented rule that routes own URL state, guards, loaders, and
composition only. It also makes workflows hard to test without routing concerns.

**Target:** A route validates URL params/search, applies guards, optionally preloads a module query,
and renders a public module page. Business workflows live behind the module barrel.

### A8. Error safety and observability are incomplete

**Severity:** Medium  
**Evidence:** `platform/query/query-client.ts`, `platform/telemetry/logger.ts`,
`platform/errors/api-error.ts`, remaining raw `.message` render sites

The global Query handler safely maps `ApiError`, but ignores other network errors. Several screens and
the AI streaming/execution paths still surface raw messages. Production logging is a no-op. Request
IDs are sent but not retained on `ApiError` or made available to an operator/support workflow.

**Target:** Every failure becomes an `AppError` carrying safe copy, machine code, retryability, and
correlation ID. Production telemetry exports redacted errors, route performance, and key UX events to
an approved sink. Audit remains server-authoritative.

### A9. Configuration and SSR behavior diverge from documentation

**Severity:** Medium  
**Evidence:** `platform/config/env.ts`, `platform/config/api-base-url.ts`, README configuration table

`VITE_API_URL` bypasses the environment schema and silently defaults to localhost. `SERVER_URL` is
declared and documented but is not consumed. The built server therefore uses the browser URL value,
or localhost if it is absent, rather than a validated server-only origin.

**Target:** One validated configuration module exposes separate public and server API origins, fails
production builds on missing/localhost values, and has tests for development, preview, and production.

### A10. Quality gates do not yet match an IAM control plane

**Severity:** Medium  
**Evidence:** `vitest.config.ts`, `.github/workflows/ci.yml`, `biome.json`

The unit suite is green but has no measured coverage or risk-based thresholds. There are no browser
journey, cross-tab, accessibility, visual-regression, or frontend/backend contract tests. Several
accessibility and security lint rules are warnings. CI has no dependency audit, CodeQL/SAST, secret
scan, SBOM, artifact provenance, or bundle budget.

**Target:** Critical IAM journeys and invariants are release gates. CI produces auditable security,
coverage, contract, accessibility, and supply-chain evidence.

### A11. Accessibility, localization, and performance are partially implemented

**Severity:** Medium  
**Evidence:** `i18n/index.ts`, `routes/__root.tsx`,
`modules/authentication/components/auth-background.tsx`, `Beams.tsx`

New namespaces are English-only, the root document language remains `en` after language changes, and
there is no automated keyboard/axe coverage. Reduced-motion mode sets animation speed to zero but
still loads Three.js and runs an always-on WebGL frame loop. Locale catalogs are statically imported.

**Target:** Locale coverage is explicit and tested, document language follows the active locale,
keyboard and axe checks gate releases, reduced motion avoids the WebGL runtime, and route/bundle
budgets prevent regressions.

## 5. Target architecture

The existing layers remain. The change is to make each boundary enforce behavior, not only imports.

```text
Browser
  -> same-origin TanStack Start server/BFF
       -> server-side session and CSRF boundary
       -> Qeet ID API

src/
  app/                 provider composition and application lifecycle
  routes/              URL schema, guards, loaders, and page composition only
  modules/<capability>/ public pages, queries, actions, schemas, components, model
  platform/
    transport/         JSON + SSE transport, correlation, safe errors, validation
    session/           SSR session, transitions, tenant context, idle/logout
    query/             QueryClient policy and scoped key conventions
    security/          capabilities, sensitive actions, step-up
    telemetry/         redaction, traces, metrics, approved exporter
    config/            validated public/server configuration
  shared/              domain-free UI and pure utilities
  tests/
    e2e/ contracts/ security/ accessibility/
```

### 5.1 Request flow

```text
route loader or module page
  -> module query/action
  -> module API + response schema
  -> platform transport
  -> BFF/session boundary
  -> Qeet ID API
```

### 5.2 Session invariants

At all times:

1. No access or refresh token is readable by browser JavaScript.
2. Protected route rendering requires a server-resolved session.
3. Tenant ID comes from the resolved session, not independent browser storage.
4. Every query and persisted domain key is scoped by session user and tenant.
5. Logout, auth loss, and tenant switch clear old scope before rendering the new scope.
6. Mutations use CSRF protection and backend authorization.

### 5.3 Module contract

A mature module should expose a small public API from `index.ts`:

```text
modules/users/
  api/                 request functions only
  schemas/             runtime request/response contracts
  queries/             scoped keys, queryOptions, mutations, invalidation
  actions/             sensitive workflow definitions
  pages/               route-level compositions exported through the barrel
  components/          module-local UI
  model/               pure transformations and policy-free domain types
  index.ts             intentional public surface
```

Do not create every folder pre-emptively. Add one only when the module owns that responsibility.

## 6. Delivery roadmap

Durations below are directional planning ranges for a small team with one frontend platform engineer,
one product frontend engineer, and named backend, security, SRE, and quality-engineering partners.
Re-estimate after Phase 0; do not treat the ranges as commitments until those partners confirm
capacity. Phase 0 precedes Phase 1. Frontend-only parts of Phase 2 may begin during late Phase 1, but
auth-coupled transport work waits for a stable session contract. Phase 4 test foundations start in
Phase 0 and become mandatory release gates as the related capabilities ship.

### Phase 0 - Containment and truthful baselines (1-2 iterations)

**Goal:** Reduce current exposure before changing the auth protocol.

**Entry:** Start immediately with current frontend and deployment owners. Production header changes
require security/SRE review but do not wait for Phase 1.

Work:

1. Add key-aware AI redaction by reusing the telemetry denylist; strip raw execution/backend errors.
2. Namespace AI conversations and other tenant-owned persistence by user and tenant; add retention and
   schema versions.
3. Add a cross-tab session-transition coordinator and clear Query/persisted state on logout, auth loss,
   and tenant switch.
4. Replace remaining raw error rendering with `errorMessage`/safe event mapping.
5. Validate `VITE_API_URL`; either implement `SERVER_URL` correctly or remove the false contract.
6. Add CSP in report-only mode, then enforce it with a nonce/hash for the theme script. Add
   `frame-ancestors`, HSTS, `Referrer-Policy`, `Permissions-Policy`, content-type protection, and
   `noindex` at the deployment edge.
7. Create a mutation inventory with columns for owner, capability, confirmation, step-up, audit event,
   query invalidation, idempotency, and test coverage.
8. Promote relevant a11y/security Biome warnings to errors after fixing the current set.

Exit criteria:

- Tests prove password/token/secret-keyed AI inputs and raw errors never enter storage or model context.
- Two-tab tests prove logout and tenant switching remove old-scope state immediately.
- Production configuration fails closed when API origins are missing or localhost.
- Staging response headers pass an automated assertion, followed by a progressive production rollout
   after security/SRE sign-off. Phase 0 containment must not wait for the Phase 1 session redesign.
- There are no known raw backend-message render sites.

### Phase 1 - Server-resolved session boundary (2-4 iterations, cross-repository)

**Goal:** Remove bearer and refresh tokens from browser JavaScript and make SSR auth real.

**Implementation status (2026-08-16): Complete in `qeet-id-console`.** TanStack Start now provides
the same-origin BFF; encrypted HttpOnly cookies hold backend token pairs; protected layouts use
server-resolved `beforeLoad` guards; JSON and SSE paths proxy through server infrastructure; mutating
server endpoints use same-origin CSRF validation; refresh is serialized across tabs and generation
guarded; legacy Web Storage credentials are purged; logout/tenant transitions propagate across tabs.
Focused unit tests and Playwright scenarios cover token stripping, cookie flags, anonymous guards,
hard refresh, CSRF, cross-tab logout, and single-use refresh coordination. Production rollout still
requires a random 32+ character `SESSION_SECRET` in the deployment environment.

**Entry:** Named frontend, backend, security, and SRE owners; an agreed backend delivery window; and
Phase 0 session-transition tests in place. Phase 1 cannot start implementation until the threat-model
ADR is approved.

Decision first:

- Preferred: a same-origin TanStack Start BFF/session gateway that owns token exchange and refresh.
- Alternative: a backend cookie-auth mode on `api.id.qeet.in` with credentialed requests.

Record the choice in a new ADR using a threat model. Evaluate Vercel/serverless session persistence,
cookie size, revocation, CSRF, CORS, subdomain scope, rotation, and incident response.

Work:

1. Implement `HttpOnly`, `Secure`, `SameSite` session cookies and CSRF for mutations.
2. Resolve the operator, tenant, expiry, and safe session metadata on the server.
3. Move route protection from effects into `beforeLoad`/server loaders.
4. Move idle timeout and logout to the application session boundary, covering admin and account routes.
5. Make refresh rotation atomic across tabs and requests at the server/session layer.
6. Roll out behind a dual-mode migration flag; revoke legacy browser token sessions after adoption.

Exit criteria:

- Web Storage contains no access or refresh tokens.
- Protected HTML is never rendered without a valid server-resolved session.
- Hard refresh, expiry, revoked session, logout, tenant switch, and simultaneous-tab refresh tests pass.
- CSRF tests prove valid same-origin mutations succeed and forged cross-origin mutations fail.
- Security review signs off the threat model and cookie configuration.

### Phase 2 - Data, transport, and action spine (2-3 iterations)

**Goal:** Make every backend interaction inherit the same enterprise controls.

**Entry:** Query-key, schema, mutation-inventory, and safe-error work may start after Phase 0. The
authenticated JSON/SSE transport must target the approved Phase 1 session contract.

Work:

1. Create platform JSON and SSE transports with shared auth, correlation, cancellation, safe errors,
   retry rules, and optional schemas.
2. Restrict direct `fetch` to platform transport files with Biome.
3. Add module-owned, tenant-aware query key and `queryOptions` factories.
4. Migrate security-critical contracts first: refresh/session, MFA, signing keys, OAuth clients,
   credentials, secrets, tenant switching, Qeet AI configuration, and all mutation responses carrying
   secret or authorization state.
5. Establish an OpenAPI-compatible backend contract source and CI drift check. Until that exists,
   continue local Zod schemas for critical endpoints.
6. Attach correlation/request ID to `ApiError`, safe UI errors, and telemetry.
7. Complete the sensitive-action inventory and migrate every classified action.
8. Define idempotency behavior for retried administrative mutations.

Exit criteria:

- No unapproved direct `fetch` calls exist.
- Every tenant-owned query key includes tenant scope through a factory.
- All critical responses are runtime validated.
- Contract tests run against the backend schema or a versioned test server.
- Every classified sensitive action uses capability, confirmation, step-up, and safe error handling.

### Phase 3 - Route-to-module migration (3-6 iterations, vertical slices)

**Goal:** Make the documented module ownership true without a big-bang rewrite.

**Entry:** Phase 2 query/action/schema conventions are implemented and demonstrated in one module.

Migration order:

1. Users, as the pilot and largest/highest-risk route.
2. Groups and invitations, reusing the established list/action conventions.
3. Organizations and billing.
4. Authentication connections and API credentials.
5. Security, compliance, and authorization workflows.

For each slice:

1. Characterize current behavior with tests.
2. Move request functions and schemas to the owning module.
3. Add scoped query/action factories.
4. Move workflows and forms into a module page/components.
5. Export the page through the module barrel.
6. Leave the route with URL validation, guard/loader, and composition.
7. Verify URLs, capabilities, translations, accessibility, and telemetry are unchanged.

Exit criteria:

- Routes do not import `api` or declare mutations.
- Route loaders consume public module query options rather than module internals.
- Cross-module imports use public barrels.
- High-risk workflows have module-level tests independent of Router rendering.
- Existing route URLs and backend contracts remain unchanged.

### Phase 4 - Enterprise verification and operations (parallel, then release gate)

**Goal:** Produce evidence that the console is safe and operable.

**Entry:** Test harness, browser matrix, telemetry destination, and initial performance baselines are
selected during Phase 0. Individual gates become mandatory before their corresponding production
capability ships.

Work:

1. Add Playwright suites for sign-in, MFA/step-up, tenant switch, user lifecycle, role changes, secret
   rotation, session revocation, permission loss, and Qeet AI confirmation.
2. Include two-browser-context tests for logout, rotation, and tenant isolation.
3. Add axe and explicit keyboard/focus tests for critical routes.
4. Measure coverage. Gate platform auth/security/transport at a higher threshold than presentation
   code; use changed-line coverage to avoid low-value test inflation.
5. Add redacted production telemetry with Web Vitals, route transitions, failed requests, schema drift,
   session events, and support-visible correlation IDs.
6. Add bundle budgets, route-chunk budgets, and a reduced-motion static auth background.
7. Load non-default locale catalogs on demand; update `<html lang>` and test locale completeness.
8. Add SCA, CodeQL/SAST, secret scanning, SBOM, artifact provenance, and dependency-update automation.
9. Pin action revisions. In BBY-hosted CI, use `bby-ubuntu`, the approved Artifactory npm virtual
   registry, and approved internal credential actions; otherwise apply equivalent hardened runners and
   registry controls.

Exit criteria:

- Critical E2E, cross-tab, contract, axe, and keyboard suites gate pull requests.
- Auth/session/transport/security coverage meets the team-approved risk threshold.
- Production errors can be traced from safe UI reference to frontend and backend telemetry.
- Dependency audit, SBOM, provenance, and secret scan are green.
- Performance budgets pass at mobile and desktop profiles.
- No high-severity lint warning remains non-blocking.

### Phase 5 - Governance and cleanup (ongoing)

**Goal:** Prevent architecture drift after the migration.

Work:

- Update ADR statuses when transitional decisions are superseded.
- Add architecture fitness tests for routes, query scope, network exits, and module barrels.
- Add CODEOWNERS for platform auth/security/transport, Qeet AI tools, and deployment security.
- Require threat-model review for new credential, impersonation, AI tool, or authorization workflows.
- Track reliability objectives for console availability, session failures, API errors, and critical
  workflow success.
- Review flags quarterly and remove expired flags and dead paths.

Exit criteria:

- CI prevents known boundary regressions automatically.
- Every transitional ADR has an owner, target date, and superseding decision.
- Ownership and review rules cover every security-sensitive surface.

## 7. Recommended first implementation backlog

Start with small, independently releasable pull requests:

| Order | Deliverable | Primary owner | Prerequisite |
|---:|---|---|---|
| 1 | AI key-aware redaction, tenant namespace, and regression tests | Qeet AI + Security | None |
| 2 | Safe error cleanup and correlation ID on `ApiError` | Frontend Platform | None |
| 3 | Cross-tab session transition coordinator and tests | Frontend Platform | None |
| 4 | Validated client/server API origin configuration | Frontend Platform | None |
| 5 | CSP report-only headers, nonce/hash design, and deployment tests | Security + SRE | Sequence after 4; design can begin earlier |
| 6 | Sensitive mutation inventory and classification | Module owners + Security | None |
| 7 | Session/BFF threat model and ADR | Frontend + Backend + Security | 3, 4 |
| 8 | Cookie/BFF session pilot behind a flag | Frontend + Backend | 7 |
| 9 | Shared authenticated SSE transport | Frontend Platform | 2, 8 |
| 10 | Query key factory and critical-schema conventions | Frontend Platform | 4 |
| 11 | Users module vertical-slice migration | Users owner | Blocked by 6 and 10 |
| 12 | Playwright auth/tenant/sensitive-action foundation | Quality Engineering | 3, 8 |

Do not combine the session redesign, route extraction, and visual redesign in one release. Each has a
different risk profile and rollback path.

The table expresses implementation prerequisites, not release bundles. Each deliverable should ship
independently when its own exit criteria pass; Phase 1 session changes use a staged, dual-mode rollout.

## 8. Required decisions

The team should resolve these before Phase 1 or Phase 2 implementation expands:

1. **Session boundary:** TanStack Start BFF or direct backend cookie auth? Recommended: BFF unless
   latency, hosting, or operational constraints make backend cookie mode materially simpler.
2. **Session persistence:** backend session record, distributed cache, or encrypted stateless cookie?
   Recommended: revocable server-side session records for an administrative control plane.
3. **Contract source:** backend-owned OpenAPI or manually maintained Zod? Recommended: backend-owned
   schema plus generated types, retaining runtime validation at trust boundaries.
4. **Telemetry:** SRE and Security own the decision. Recommended: align with the backend OpenTelemetry
   pipeline, keep redaction in-process before export, define sampling/retention, and make correlation
   searchable without exposing raw backend messages or PII.
5. **Feature flags:** Product Platform and SRE own the decision. Recommended: retain build-time flags
   only for bundle omission and add a backend-authoritative remote emergency kill switch for risky
   runtime capabilities; every flag needs an owner and removal date.
6. **Localization:** Product and Localization own the decision. Recommended: English remains the
   source locale; do not advertise another locale as complete until critical namespaces meet parity;
   load non-default catalogs on demand and retain explicit English fallback.
7. **Risk thresholds:** Frontend Platform, Security, and Quality Engineering approve these before
   Phase 2 exits. Starting proposal: at least 90% line and 85% branch coverage for auth, session,
   transport, platform security, and the Qeet AI execution engine; at least 70% line coverage overall;
   100% pass rate for the critical E2E release set; zero serious/critical axe findings; latest two
   Chrome, Edge, and Firefox releases plus current/previous Safari; and no route/startup bundle grows
   more than 5% before absolute budgets are established from Phase 0 measurements.

## 9. Program measures

Track outcomes rather than file movement:

| Outcome | Measure |
|---|---|
| Browser session safety | Zero auth/refresh tokens in Web Storage |
| Tenant isolation | Zero cross-tenant cache/persistence failures in two-context tests |
| Contract safety | Percentage of critical endpoints runtime validated |
| Consistent sensitive actions | Percentage of classified actions using the shared pipeline |
| Route ownership | Route files importing `api` or declaring mutations, target zero |
| Operability | Percentage of production failures carrying a support-visible correlation ID |
| Accessibility | Zero critical axe violations; critical journeys keyboard-complete |
| Delivery confidence | Critical E2E/contract/security suites green before deploy |
| Performance | Route and startup bundles remain within agreed budgets |
| Supply chain | SCA/SBOM/provenance gates green for every release |

## 10. Explicit non-goals

- No framework migration.
- No microfrontend split.
- No new global state library for server state.
- No replacement or local fork of `@qeetrix/ui`.
- No mass rewrite of all API files in one pull request.
- No frontend reimplementation of backend RBAC, ABAC, ReBAC, or RLS.
- No visual redesign mixed into the architecture hardening program.

## 11. Definition of enterprise-ready

The console can reasonably claim enterprise readiness when:

1. Authentication and tenant context are server-resolved and unavailable to browser scripts.
2. Session and tenant transitions are atomic across tabs and persisted state.
3. Critical backend contracts fail closed at the transport boundary.
4. Sensitive actions consistently apply capability, confirmation, step-up, and audit semantics.
5. Routes are thin and capability modules own workflows.
6. Safe, redacted telemetry connects operator-visible references to backend traces.
7. E2E, tenant-isolation, accessibility, contract, supply-chain, and performance checks gate releases.
8. Architecture rules are enforced by CI and owned through current ADRs and CODEOWNERS.

Until then, describe the repository as having a strong layered foundation with an active enterprise
hardening program, rather than as a completed enterprise architecture.

## Appendix A - Reproducing the audit baseline

Run from `qeet-id-console`. These commands intentionally use repository tools available on macOS and
CI. Generated `routeTree.gen.ts`, tests, and test directories are excluded only from the production
file/line measure. The mutation scan covers all `src` files and therefore describes declarations, not
unique backend operations or actions that are necessarily security-sensitive.

```bash
find src -type f \( -name '*.ts' -o -name '*.tsx' \) \
   ! -name 'routeTree.gen.ts' ! -name '*.test.ts' ! -name '*.test.tsx' \
   ! -name '*.spec.ts' ! -name '*.spec.tsx' ! -path '*/__tests__/*' -print

find src/routes -type f \( -name '*.ts' -o -name '*.tsx' \) -print

rg -l '\b(useQuery|useMutation|useInfiniteQuery)\b|queryKey:|invalidateQueries\(' src/routes
rg -n 'method:\s*"(POST|PUT|PATCH|DELETE)"' src
rg -l 'useSensitiveAction\(' src
rg -n 'schema\s*:' src
rg -n '\bfetch\(' src
find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \
   -o -name '*.spec.ts' -o -name '*.spec.tsx' \) -print
```

Pipe the relevant file lists to `wc -l` for file counts and `xargs wc -l` for line counts. Direct
`fetch` results require classification: the code-generation example contains a string that is not an
executed console request. Record the resulting report as a CI artifact once an automated architecture
fitness script is added in Phase 0.

## Appendix B - Test terminology

**Two-tab test:** Two pages in the same authenticated browser context. Use it to verify browser-native
cross-tab propagation through `BroadcastChannel` or storage events.

**Two-context test:** Two independent Playwright browser contexts with separately controlled cookies,
storage, users, or tenants. Use it to prove that one user's or tenant's Query cache, persisted state,
session transition, and authorization result cannot appear in the other context. Session tests should
include both forms where the invariant differs.