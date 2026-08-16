# Qeet ID Console — Engineering Standards, Naming & Development Rules

## 1. Purpose

This document defines the mandatory engineering conventions for Qeet ID Console.
The goal is to ensure that every new feature, bug fix, refactor, security change,
and maintenance change follows a consistent architecture. These rules apply to
all new and modified code.

The codebase must remain: predictable · discoverable · secure · testable ·
maintainable · consistently named · easy for new engineers to understand.

Do not optimize for the smallest number of files. Optimize for:

```text
clear ownership + clear responsibility + low duplication + strong boundaries
+ testability + security + maintainability
```

## 2. Top-Level Architecture

```text
src/
├── app/          Bootstrap / providers
├── i18n/         Locale resources
├── modules/      Business capabilities
├── platform/     Application infrastructure
├── routes/       URL/routing composition (not a business-logic container)
├── shared/       Generic, domain-agnostic reusable code
└── router.tsx
```

- **modules/** — authentication, authorization, users, organizations, security,
  developer, billing, compliance, activity, timeline, search, qeetai, …
- **platform/** — api, auth, errors, query, security, telemetry, config, feature-flags
- **shared/** — components, hooks, utils, data, types
- **routes/** — routing composition only

## 3. Naming Philosophy

Names must answer: **"What responsibility does this file own?"** Avoid names that
require opening the file to understand it.

Prefer descriptive nouns (`user-filters.ts`, `authorization-policy.ts`,
`session-refresh.ts`). Avoid generic nouns (`helpers.ts`, `utils.ts`, `common.ts`,
`misc.ts`, `logic.ts`, `data.ts`, `manager.ts`, `service.ts`, `handler.ts`,
`processor.ts`). A generic name is permitted only if the abstraction has a clear,
stable, well-defined responsibility.

## 4. File Naming Convention

Lowercase kebab-case: `user-profile.tsx`, `authorization-policy.ts`,
`authorization-policy.schema.ts`, `use-organization.ts`, `organization-store.ts`.
Not `UserProfile.tsx`, `user_profile.ts`, `userProfile.ts`, `USER_PROFILE.ts`.
Exception: framework-generated route files (e.g. `routeTree.gen.ts`) keep their names.

## 5. React Component Naming

File `component-name.tsx`; symbol `PascalCase`. Avoid `component.tsx`, `widget.tsx`,
`section.tsx`, `view.tsx` unless genuinely that generic.

## 6. Hook Naming

Hooks begin with `use-` and represent behavior, not generic containers. Prefer
`use-user-filters` over `use-user-state` when it manages filtering.

## 7. API File Naming

`<domain>.api.ts`, or `<domain>.ts` when the directory is already `api/`. Prefer
consistency within a module. Never `service.ts`/`manager.ts`/`client.ts`/`helper.ts`
for feature APIs. `platform/api/client.ts` is allowed — it's the canonical HTTP client.

## 8. Schema File Naming

`<domain>.schema.ts` (e.g. `create-user.schema.ts`). Not `validation.ts`/`data.ts`.

## 9. Type File Naming

Keep types close to the owning domain (`types.ts`, `user.types.ts`). Avoid a global
`shared/types.ts` dumping ground; only truly cross-domain types belong in `shared/types`.

## 10. Store Naming

`<domain>-store.ts`. Never create a store for server state that TanStack Query should own.

## 11. Utility Naming

Name by the operation (`format-duration.ts`, `normalize-email.ts`,
`build-search-query.ts`, `redact-sensitive-data.ts`). Not `utils.ts`/`helpers.ts`/
`common.ts`/`misc.ts`/`format.ts`. Utilities are pure, deterministic, reusable, and
domain-agnostic when in `shared/utils`.

## 12–13. Module vs Shared Utilities

Domain-specific utilities stay in their module (`modules/authorization/utils/`).
Promote to `shared/utils` only when ALL hold: genuinely reusable · domain-agnostic ·
stable contract · ≥2 unrelated consumers · no hidden coupling.

## 14–15. Duplication & the Three-Use Rule

Classify duplication before refactoring: LOCAL · MODULE · SHARED · PLATFORM ·
DUPLICATE-BUT-INTENTIONALLY-SEPARATE. `1 use → local`, `2 → evaluate`,
`3+ → consider abstraction`. Semantic ownership matters more than textual similarity.

## 16–17. Hook vs Utility vs Component

Hook when behavior needs React; utility when it doesn't; component when it owns UI.
Never turn a pure function into a hook unnecessarily.

## 18–19. Services & API vs Domain Logic

Avoid generic `*-service.ts`; prefer explicit names (`activity-stream.ts`,
`activity-search.ts`, `organization-membership.ts`). Flow:
`component → hook → module API → platform API`. API files do request creation,
invocation, request-specific validation, response mapping — not large UI workflows.

## 20. Route Rules

Routes: config, loaders, URL/search params, guards, page composition. Not: reusable
API functions, domain calculations, authorization algorithms, reusable hooks, large
workflows. Extract into the owning module when a route grows.

## 21. File Size Guidance

Not an absolute rule. Investigate a file when it owns multiple unrelated
responsibilities, has independent workflows, is hard to test, or has many branches. A
cohesive 500-line component beats ten meaningless 50-line abstractions.

## 22–23. Function & Boolean Naming

Functions use verbs (`loadUsers`, `createOrganization`, `normalizeError`,
`redactForModel`). Booleans use `is*`/`has*`/`can*`/`should*`/`requires*`/`supports*`.

## 24. Event Naming

Hierarchical, stable once external systems depend on them: `auth.sign_in`,
`organization.switched`, `security.step_up_required`, `ai.tool_completed`.

## 25. Query Key Naming

Feature-owned query-key factories (`usersKeys.list(orgId, filters)`), never scattered
raw strings. Include org/tenant scope where data is scoped.

## 26. Error Naming

Domain-specific where useful (`session-expired`, `step-up-required`). Machine codes
are stable (`AUTH_SESSION_EXPIRED`, `AUTH_STEP_UP_REQUIRED`). Never expose stack traces
or backend internals to users.

## 27. Security-Sensitive File Naming

Security behavior must be obvious from the filename (`step-up.ts`,
`sensitive-action-provider.tsx`, `capability-model.ts`, `effective-permissions.ts`,
`token-store.ts`, `redact.ts`). Never hide it in `helpers.ts`/`utils.ts`.

## 28–29. Test Naming & Organization

Tests name the behavior/invariant (`client-refresh.test.ts`, `step-up-recovery.test.ts`,
`error-redaction.test.ts`). Colocate `<source>.test.ts`; large cross-module flows go
under `tests/{e2e,integration,security,accessibility,contracts}`.

## 30. New Feature Flow

1. Identify the owning module. 2. Search for existing functionality. 3. Check shared
abstractions. 4. Design the smallest appropriate abstraction (local first).
5. Create predictable files. 6. Tests accompany the implementation. 7. Update ADRs for
new patterns.

## 31–33. Bug Fix / Refactor / Security Rules

Bug fix: reproduce → owning module → root cause → regression test → check for siblings.
Refactor must NOT silently change routes, URLs, API behavior, authorization, tenant
scope, security, translations, accessibility, or analytics semantics without explicit
approval. Security-sensitive code requires ownership, tests, threat consideration, safe
telemetry, no secret logging, backend-authoritative enforcement, and regression coverage.

## 34–36. Shared Component / Hook / Utility Rules

`shared/*` only when multiple unrelated modules need it, the contract is stable, and it
carries no domain knowledge. `UserPermissionTable`, `AuthorizationPolicyCanvas`,
`OAuthClientCard` stay in their modules.

## 37–38. Review Checklists

**Naming:** descriptive name · identifies responsibility · correct boundary · no
duplicate · hook/component/util/module/platform decision correct · API/schema/test
clearly named · generic names avoided · public API via index.ts · internals private.
**Architecture:** correct module/layer · no forbidden imports · no cycles · no
duplication · no unnecessary abstraction · tenant scope · authorization · platform API
client · runtime validation · scoped query keys · normalized errors · no sensitive
logging · i18n · a11y · tests.

## 39. Anti-Patterns

No `helpers.ts`/`utils.ts`/`common.ts`/`misc.ts`/`manager.ts`/`service.ts`/`handler.ts`/
`processor.ts` unless the responsibility is specific and documented. No
`shared/utils/everything.ts`, `modules/common/`, global state for server state, routes
becoming domain modules, or shared code depending on domain modules.

## 40–42. Golden Rules

Ask **"Where does this behavior belong?"**, not "Where can I put this file?". Flow:
`Issue → Understand → Find ownership → Search existing → Smallest abstraction →
Implement → Test → Security review → Architecture review → CI`. The codebase stays
MODULE-OWNED · PLATFORM-BACKED · SHARED-ONLY-WHEN-GENERIC · ROUTE-LIGHT · SECURITY-FIRST
· TESTED · OBSERVABLE · DESCRIPTIVELY NAMED. Optimize for clear ownership and
predictable maintenance, not fewer files.
