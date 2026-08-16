# Qeet ID Console — Current-State Architecture (pre-refactor baseline)

> Discovery artifact for the Enterprise Architecture Refactor & Hardening effort.
> Captures the codebase **as of the start of the refactor** so the migration is
> auditable. No behavior is changed by this document.

## 1. Stack

TanStack Start (Vite 8 + Nitro SSR) · TanStack Router (file-based) · TanStack Query · TanStack Store ·
TanStack Form/Table · React 19 + React Compiler · Biome 2.5.x · zod 4 · i18next (10 locales) ·
`@qeetrix/ui` design system · bun. Single path alias `@/* → src/*`. **Every cross-layer import uses
`@/*`; intra-feature imports are relative** — this is what makes specifier-based boundary linting viable.

## 2. Layout (as found)

```
src/
├── components/       cross-domain UI: data-table/, confirm-dialog, page-header, logo-field, step-up-dialog
├── config/           navigation.tsx (IA + capability map + title lookup), navigation-state.ts
├── features/         15 dirs: access-control, activity, auth, authorization, billing, compliance,
│                     dashboard, oidc, onboarding, orgs-list, qeetai, search, timeline, user360, users-list
├── integrations/     tanstack-query/root-provider.tsx (QueryClient + global toast/403 middleware), devtools
├── i18n/             index.ts + locales/ (en has 19 namespaces; 7 other locales have 10)
├── lib/              48 flat files — the data/domain/HTTP/token/util god-folder
├── routes/           99 route files (__root, _app, _auth, account)
├── env.ts router.tsx routeTree.gen.ts styles.css
```

## 3. Dependency reality

- **`@/lib` is imported by 153 files**; `@/features` by 87. Top fan-in: `@/lib/api` (82), `@/lib/auth`
  (51), then a long tail (billing 13, users 9, export 9, user360 8, list-view 8, authz-* ~6, most 1–3).
- **`src/lib` is mostly a leaf** (features/routes → lib; lib rarely → features). One **type-only** cycle:
  `config/navigation.tsx` ↔ `features/access-control/capability-model` (cut at runtime).
- Cross-feature deep imports that exist today: `features/access-control/*` (many → will become platform),
  `user360/{shared,utils}` (users-list), `activity/*` (dashboard), `onboarding/onboarding-profile` (dashboard).

## 4. `src/lib` classification (root cause)

Each file typically bundles **TS interfaces + React Query `use*` hooks + `api()` calls**. Concerns are
mixed with no separation:

- **Infra:** `api.ts` (HTTP client + `ApiError` + `tokenStore`(localStorage) + single-flight refresh +
  auth-lost redirect — infra + security + state in one file).
- **Session:** `auth.ts` (640 lines; login/signup/invite/MFA/magic-link/SAML/social/password + session
  hooks `useTenantId`/`useMe`/`useImpersonationActor`/`useIdleLogout` + client JWT `act` decode).
- **Authorization domain:** `authz-{abac,rbac,simulate,audit,codegen,templates,store}`, `relationships`,
  `rbac-groups`, `access-check`.
- **Users/orgs:** `users`, `user360`, `orgs`.
- **Security data-clients:** `mfa`, `passkeys`, `device-auth`, `ip-allowlist`, `credentials`, `secrets`,
  `signing-keys`.
- **Auth/identity data-clients:** `oidc-clients`, `saml`, `saml-idp`, `scim`, `ldap`, `sso`, `domains`,
  `social-identities`, `oauth-grants`, `admin-portal`, `auth-hooks`, `auth-policy`.
- **Activity/audit/ops:** `analytics`, `anomalies`, `audit-anomalies`, `bots`, `log-sinks`, `retention`,
  `notifications`.
- **Billing/AI/templates:** `billing`, `agents`, `email-templates`, `qeetai`.
- **Pure / static / UI / state (do NOT belong with data-clients):** `authz-codegen` + `authz-templates`
  (pure/static), `authz-store` (react-store), `export` + `list-view` + `shortcuts` (generic UI/util),
  `regions` (static).

## 5. Cross-cutting behavior (keep and build on)

- **`api()` (`lib/api.ts`)** is the single request choke point: Bearer attach, single-flight 401 refresh +
  replay, `ApiError` normalization from the backend `error` envelope. Tenant id is interpolated into the
  **URL path** (not a header). **No outbound request/correlation IDs.**
- **`integrations/tanstack-query/root-provider.tsx`** is an existing cross-cutting layer: global
  QueryCache/MutationCache `onError`→toast (special-cases billing codes, suppresses 401/400/422, generic
  403), `onSuccess`→toast, typed `meta` (`silent`/`successMessage`) via module augmentation, and
  403→invalidate `["effective-permissions"]`. **Line 57 prints raw backend `error.message`** (leak vector).
- **Auth guards are client-side `useEffect` redirects** (not `beforeLoad`) because the token is in
  localStorage and invisible to SSR. `isAuthenticated() = !!tokenStore.get()`. No route loaders.
- **Capabilities:** frontend fetches backend-resolved effective permissions into a `Set`
  (`capability-provider` exposes `can/canAll/canAny/canAccessPath`); `AccessBoundary` maps path→capability.
  Explicitly UX-only — backend is authoritative.

## 6. Problems this refactor addresses

1. `src/lib` mixes 6+ concerns; a feature's contract lives outside the feature.
2. Two data conventions: `lib` `use*` hooks vs. inline `useQuery`+`api()` in **53 route files**.
3. Layering is documented (README "Boundaries") but **not enforced** (Biome custom rules are `warn`; lint
   gate runs at `--diagnostic-level=error`).
4. **No runtime validation** (zod only in `env.ts`); a malformed effective-permissions payload silently
   becomes a garbage capability `Set`.
5. **No React error boundary** anywhere; raw backend message reaches toasts/alerts.
6. **Step-up re-auth wired to one screen** (TOTP); other sensitive actions dead-end on `step_up_required`.
7. **Qeet AI**: `assign_role`/`grant_permission`/`set_strict_mfa`/`create_*` are `destructive:false` (no
   confirmation); execution not gated by `enabledTools`; no step-up recovery; PII flows to model + full
   conversation persists to localStorage and survives logout. (Correct: runs under operator token, no
   privilege bypass; secrets kept in-memory only.)
8. **Tokens (access+refresh) in localStorage** (XSS-exfiltratable) — deferred (needs server + SSR-guard rework).
9. **Tests invert the risk profile**: security-critical layers (`api.ts` refresh, `authz-*`, all 21 Qeet AI
   tools) have zero tests; no e2e/a11y/CI.

## 7. Migration risks

- **High fan-in choke points:** `api.ts` (82) and `auth.ts` (51) — must move behind re-export shims before
  any importer is touched; split `auth.ts` session vs flow importers in two passes.
- **Boundary conflict:** `PageHeader` (used by ~65 sites via nav auto-title) depends on the IA
  (`navigation`) → it is **not** generic shared; it moves to `platform/components`, not `shared`.
- **`vitest.config.ts` only aliases `@ → ./src`** (bypasses the Start/Nitro plugin chain) → tsconfig
  per-file path-alias bridging would break tests. Use **physical re-export shims**, which resolve
  identically under tsc, vite, and vitest.
- **Baseline (must stay green every step):** `typecheck` ✓ · `test` 16 files / 157 tests ✓ · `build` ✓.
