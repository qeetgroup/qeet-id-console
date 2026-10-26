# Workflows — qeet-id-console

**Level:** L2 · **Last verified:** 2026-10-23
**Verification scope:** every command checked against `package.json` and
`.github/workflows/ci.yml`.

## Set up

```bash
bun install
cp .env.example .env.local
bun run dev                    # serves on 3002 — see the port note below
```

> **Runs on 3002.** The `dev` script pins `--port 3002` to match `qeet-id-server`'s
> `APP_BASE_URL=http://localhost:3002`, which allowlists 3000–3003 + 5173 for CORS and
> WebAuthn. Redirects and passkeys only work on 3002 — don't override the port.

`VITE_ENABLE_DEVTOOLS=true bun run dev` opts into the TanStack devtools launcher.

## Add a page

```text
1  find the subsystem        docs/llm/subsystems.md
2  page component            src/modules/<name>/components/<page>.tsx, exported from the
                             module's pages.ts (routes only), not its barrel
3  route file                src/modules/<name>/routes/app/<url path>.tsx (routes/public/ for a
                             page outside the signed-in shell) — createFileRoute,
                             staticData: { capability }, search validation and the page from
                             @/modules/<name>/pages; params reach the page as props
4  navigation entry          the module's manifest.tsx `nav`, with the same capability
5  data access               the module's api/ dir, NEVER fetch from the component
6  states                    the platform DataState for loading, empty and error
7  i18n                      add strings to the module's locales/en/<ns>.json; others fall back
8  test
9  bun run typecheck && bun run check && bun run lint:boundaries && bun run test
```

`src/modules/users` is the reference: `UsersPage`, `UserDetailPage` and their thin routes.
The dev server or a build regenerates `src/routeTree.gen.ts` for a new route file.

**The route's `staticData.capability` is what gates the page.** `getRequiredCapabilityForPath`
reads it, and `AccessBoundary` enforces it in the UI. Both are UX — the backend still decides.
A nav entry naming a different capability from its route fails `route-capability.test.ts`.

## Call a new endpoint

```text
1  VERIFY IT EXISTS in qeet-id-server — never invent one
2  key: add it to the module's key factory, under [module, tenantId, …]
3  read: a queryOptions entry (see userQueries) and a hook that uses it
   write: a mutation that refreshes what it changed, by key prefix
4  call api(path, opts) from src/platform/api/client.ts — the ONLY request path
5  a Zod `schema` for anything critical (MFA, secrets, sessions, tenant switch)
6  map errors through the module; never render error.message
7  test
```

**If the endpoint issues credentials**, it must be in the allowlist in
`src/platform/auth/session-response.ts`, or the BFF will reject it with
`502 client.unexpected_token_response`. That is deliberate.

## Add or change a module

```text
1  bun run new-module <id>      ← creates src/modules/<id>/ from the template and adds <id>
                                  to src/app/modules.ts (the only file outside the folder)
2  bun run dev                  ← regenerates the route tree; the page is at /<id>
3  fill in api/, components/, routes/, locales/en/<id>.json and manifest.tsx
4  the barrel (index.ts) is the module's public surface — other modules may import ONLY it
5  do not import @/routes or @/app from a module
6  bun run lint:boundaries && bun run test   ← module-registry and module-boundaries tests
```

Every module has a barrel. Export from it only what another module or a route needs, by name (no
new `export *`).

What a module adds to the shell goes in its `manifest.tsx`, never in a platform table:

| To add | Manifest field |
|---|---|
| A sidebar entry (group, order, capability, parent for a sub-entry) | `nav` |
| A command-palette entry | `commands` |
| A `g <key>` shortcut | `shortcuts` |
| A feature flag (owner, description, `expires` date or `null` for a kill switch) | `flags` |
| Qeet AI suggestions for its pages | `extensions.qeetaiSuggestions` |
| A namespace of its own | `locales/en/<ns>.json`, declared in the manifest's `ResourceNamespaceMap` block |

Copy in a manifest is a key in the module's namespace (`<ns>:nav.*`, `<ns>:commands.*`). A module
offers its own extension point by augmenting `ModuleExtensions` in
`src/platform/modules/manifest.ts` from its own folder (see `qeetai/suggestions/route-suggestions.ts`)
and reading it with `extensionContributions()`.

A **route** stays thin: `createFileRoute`, its guards (`beforeLoad`, `head`), a Zod search schema
(`searchText()` / `searchEnum()` from `src/shared/utils/search-params.ts`) and the page from the
owning module's `pages.ts`. It may import a module's barrel and its `pages` entry, but not its
internals, `api()` or `@tanstack/react-query` (lint); it reads params and search and passes them
to the page as props. No route is exempt from this, and none may be.

During the move to `@qeetrix/react` (`docs/migration/qeetrix-react.md`), pages already rebuilt on
it are exported from a second route entry, `entry-pages.ts` (for authentication: sign in with its
two-step challenge and setup, sign up, verify email, magic link, forgot and reset password, and
choosing an organisation), so routes still on `@qeetrix/ui` don't load the new library through a
shared `pages.ts`. Biome allows `@/modules/<name>/entry-pages` as it does `pages`. Those pages are
styled with `@qeetrix/react` components and a small token-only CSS file, never Tailwind.

## Change session or auth behaviour

**Security review required.**

```text
1  src/platform/auth/server-session.ts   (cookie, sealing, PublicSession)
   src/platform/api/server-proxy.ts      (bearer, refresh, single-flight)
   src/platform/auth/session-response.ts (token-issuing allowlist)
2  TOKENS MUST NOT REACH THE BROWSER
3  keep unseal failures FAIL-CLOSED (clear the session, return {})
4  bun run test:e2e — the browser suite checks the session boundary, the CSP and WCAG 2.2 AA
```

Never add a token to `PublicSession`. Never reintroduce localStorage token keys.

## Change authorization surfacing

```text
1  src/platform/security/capability-model.ts   (the 25 capabilities)
2  the route's staticData: { capability }      (path → capability), and the
                                               matching nav entry in its manifest
3  remember: UX ONLY. The backend decides
4  a new capability must exist in qeet-id-server first
5  test capability-model + route-capability
```

**Never re-implement RBAC/ABAC evaluation in the browser.**

## Add a sensitive action

```text
1  sensitive = gated in qeet-id-server/internal/bootstrap/stepup.go, or it ends someone's access
2  use useSensitiveAction() — do NOT hand-roll a confirm dialog
3  run: a mutation's mutateAsync · actionLabel: names it in the step-up dialog
   confirm: only when destructive or irreversible
4  end the promise with .catch(settleSensitiveAction)
5  it gives: capability pre-check (UX) → confirm → step-up → retry once
6  RequireRecentMFA on the backend stays authoritative
```

A non-sensitive yes/no goes through `useConfirmDialog`. The users actions repeat on several
surfaces, so `useUserActions` holds them once.

## Build a form

```text
1  useAppForm from src/platform/forms/app-form.tsx; fields via form.AppField + field.TextField,
   PasswordField or SelectField; a composite control inside FieldFrame
2  validators: { onSubmit: <Zod schema> }, built with the page's t() for its messages
3  onSubmit: run the mutation (through useSensitiveAction when sensitive); on a refusal call
   applyServerErrors(formApi, err) — a 422 marks the fields it names
4  render <FormError error={mutation.error} /> and form.SubmitButton
```

## Show a one-time secret

```text
1  OneTimeSecret from src/shared/components/one-time-secret.tsx
2  the value lives in component state only — never the query cache or browser storage
3  the mutation that returns it: gcTime 0
```

## Change the SSRF guard or CSRF

**Security review required.** `src/platform/api/server-request-policy.ts`, `src/start.ts`.
Never widen the origin check; never exempt a server function from CSRF.

## Refactor

```text
1  behaviour must not change
2  respect the layer rules — bun run lint:boundaries WILL fail otherwise
3  cross-module access goes through barrels
4  never hand-edit src/routeTree.gen.ts
5  bun run check && bun run test
```

## Finish any task

```bash
bun run typecheck && bun run check && bun run lint:boundaries && bun run test
git diff
```

If you touched `src/platform/{api,auth}`, a page, or anything the CSP governs, run `bun run test:e2e`
(builds, then runs Playwright). It checks that no token reaches `localStorage`, `document.cookie` or
the rendered HTML, the cookie flags, hard refresh, CSRF, cross-tab logout and refresh coordination;
that every page runs under its nonce CSP without a violation; and that the main pages and overlays
meet WCAG 2.2 AA in both themes.

### Escalate rather than proceed

A token in the browser · treating a capability as enforcement · bypassing `proxyApiRequest` ·
relaxing the SSRF guard or CSRF · calling an endpoint that does not exist · editing the generated
route tree · anything requiring another repository.
