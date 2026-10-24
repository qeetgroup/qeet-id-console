# AGENTS.md — qeet-id-console

**The model-neutral instruction file for coding agents.** [CLAUDE.md](CLAUDE.md),
[GEMINI.md](GEMINI.md) and [.github/copilot-instructions.md](.github/copilot-instructions.md) point
here and add nothing architectural.

## What this repository is

The **operator console for Qeet ID** — `console.id.qeet.in`. TanStack Start + TanStack Router,
React 19, Vite 8 + Nitro, Tailwind v4, `@qeetrix/ui`, bun. 18 modules under `src/modules/`.

It is a **client with a server side**: TanStack Start acts as a same-origin
backend-for-frontend (BFF). **Backend tokens never reach the browser.**

## Context hierarchy

```text
qeet-context (L0)  →  qeet-id-context (L1)  →  qeet-id-server (the contract + all enforcement)
                                            →  qeet-id-console (L2 — this repository)
```

## Read before changing code

| File | For |
|---|---|
| [qeet-repo.yml](qeet-repo.yml) | Machine-readable identity |
| [docs/llm/architecture-map.md](docs/llm/architecture-map.md) | "Where is X?" |
| [docs/llm/context.md](docs/llm/context.md) | How the console works |
| [docs/llm/subsystems.md](docs/llm/subsystems.md) | The 18 modules + platform, with real paths |
| [docs/llm/boundaries.md](docs/llm/boundaries.md) | Layering rules and what must not change |
| [docs/llm/workflows.md](docs/llm/workflows.md) | Step-by-step for common changes |

## Rules

### 1. The backend is the authority
**Client capabilities are UX only.** Never re-implement RBAC/ABAC evaluation in the browser. Hiding
a button is a convenience; the API rejecting the request is the control. If hiding a button is the
only thing preventing an action, that is a **backend** defect.

`SECURITY.md` opens with it: *"The backend is always the authority."*

### 2. Tokens never reach the browser
The access/refresh pair lives in an encrypted, chunked `__Host-qeet_console` cookie, read only
server-side. The browser gets `PublicSession` — no tokens. **Never add a token to client state,
`localStorage`, or a server-function return value.**

`src/platform/auth/session-store.ts` actively purges the legacy `qeetid.access_token` keys on
startup. Do not reintroduce them: browser-held tokens were the model this BFF replaced.

### 3. Layering is enforced by lint and tests, and CI runs both
```text
app → modules → platform → shared
```
Biome `noRestrictedImports` overrides in `biome.json` fail the build:
- `src/shared/**` may import only `@/shared`, `@/i18n`, or external packages
- `src/platform/**` may import only `@/platform`, `@/shared`, `@/i18n`; it reaches modules only
  through the registry `src/app` fills (`src/platform/modules/registry.ts`)
- `src/modules/**` must not import `@/routes` or `@/app`
- `@/lib` is retired — never import it
- `noImportCycles` is `error`

`bun run lint:boundaries` is a CI step. The test suite holds the rest
(`src/__tests__/module-boundaries.test.ts`):
- a module reaches another **only through its barrel** (`@/modules/<name>`), never its internals;
  its own files it imports as `@/modules/<own>/…` (or `./`, `../`)
- no import climbs more than one folder: anything farther is imported through `@/`
- a route file (`src/modules/*/routes/**`, and the shell's few in `src/routes`) must not import
  `api` from `@/platform/api/client` or `@tanstack/react-query`: data access belongs to the
  module. No route is exempt; never add an override that exempts one.
- `DataState` comes from `@/platform/components/data-state`, never `@qeetrix/ui` (rule 5), and
  `StatusPill` from `@/platform/components/status-pill`: the kit's names a status in English.

### 4. All API traffic goes through one path
`src/platform/api/client.ts` → server function `proxyApiRequest` → backend. **This is the only place
requests leave the app.** Correlation IDs, schema parsing and telemetry are added there so every
caller inherits them. Server-sent events go through `openEventStream` / `readServerSentEvents`
(`src/platform/api/event-stream.ts`) to the BFF stream routes, with the same session renewal.
Biome bans the global `fetch`, `EventSource`, `WebSocket` and `XMLHttpRequest` outside
`src/platform/api/`.

### 5. Never render a backend `error.message`
`src/platform/errors/user-message.ts` is "the leak stop" — backend messages may carry internal
context. Map a code to safe copy via `userMessageForCode` / `errorMessage`. The `@qeetrix/ui`
`DataState` prints `error.message` by default, so use the platform `DataState`
(`src/platform/components/data-state.tsx`), which maps it first; lint enforces this.

### 6. Redact telemetry
`src/platform/telemetry/redact.ts` has a hard denylist (token, secret, password, cookie, api-key,
otp, …) plus masking of token-shaped strings, query strings, emails and IPs. Never log a raw payload
around it. Production telemetry goes only to the console's own server log
(`src/platform/telemetry/server-log.ts`: JSON lines on stdout, every field redacted), never to a
third party; log a path by its template (`pathTemplate`), never with ids or a query. The logger is
server-only: `vite build` fails if it would reach the browser bundle, so call it from server
functions, server routes or `createServerOnlyFn`. The browser reports errors and Web Vitals
(`client-reporter.ts`) through the `reportClientTelemetry` server function (`client-report.ts`),
which takes only its Zod allowlist.

### 7. Sensitive actions go through the shared primitive
`useSensitiveAction()` gives one capability → confirm → step-up → retry path. Backend
`RequireRecentMFA` stays authoritative. Do not hand-roll a confirm dialog for a sensitive mutation.
A mutation is sensitive when the backend gates it behind a step-up
(`qeet-id-server/internal/bootstrap/stepup.go`) or it ends someone's access (revoke, suspend,
delete, purge, disable SSO). Run it as a mutation, pass an `actionLabel`, `confirm` only what is
destructive, and end the chain with `.catch(settleSensitiveAction)`.

### 8. Runtime schemas guard the critical boundaries
Pass `schema` to `api()` where wrong data would do harm: MFA, credentials and secrets, sessions,
the tenant switch. Derive the type from the schema (`z.infer`), and match the server's Go struct:
`omitempty` is optional. A mismatch throws `client.schema_mismatch` — **fail closed rather than
hand garbage to the UI.**

### 9. `routeTree.gen.ts` is generated
Committed, and marked read-only in `.vscode/settings.json`. **Never hand-edit it.**

### 10. Person or tenant data in browser storage goes through `scopedStorage`
`src/platform/auth/scoped-storage.ts` keys every value by person and tenant, so a shared browser
never shows one person's data to another, and wipes it on sign-out. Never write AI history, search
history, saved views or any backend-derived data to an unscoped `localStorage` key. Device
preferences (theme, language, a panel's width) may stay unscoped; a dismissal about the person or
the organization, such as the setup checklist, is scoped. The idle sign-out's shared
`qeetid.last-activity` (`src/platform/auth/idle-activity.ts`) holds only a timestamp, so every tab
can read it: a tab signs out when no tab has seen activity for the limit. Keep it a bare number.

### 11. The server holds no per-person state in module scope
On the server one module instance serves every concurrent request. The session store ignores
writes there; resolve the session per request (`getServerSession`). Never cache a person's data in a
module-level variable that server code can reach.

### 12. Every page meets WCAG 2.2 AA, and a pull request proves it
`tests/e2e/accessibility.spec.ts` runs axe (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa`, `wcag22aa`) on the signed-out screens and the main console pages in light
and dark themes, and on overlays a page scan can't reach (command palette, a create sheet, a
confirm dialog, a menu). Any violation fails the "Session E2E" job. Fix it in the console:
- An icon-only button, a select trigger (a combobox takes no name from the value it shows) and a
  field each get a name: a visible `<label htmlFor>` or `FieldLabel`, else an `aria-label` from the
  catalogue. When a control has visible text, its name begins with that text (2.5.3 Label in
  Name); hide decoration that would read as words (initials, keycaps) with `aria-hidden`.
- Colours come from the tokens: fix contrast by choosing the right token, never a hard-coded colour.
- A decorative chart sets `accessibilityLayer={false}`, so recharts doesn't make it focusable.
- A new page or overlay gets a scan in the spec, with fake-backend data for its real content.

A violation from inside an `@qeetrix/ui` component that the console can't fix is excused for
**that rule on that element only**: an entry in the spec's `DESIGN_SYSTEM_ISSUES` (one rule, one
element selector, every other rule still applies), with a comment naming it as a qeetrix issue, and
raised as a QTRX ticket. Never disable a rule for a page, and never excuse a console-owned element.

## Conventions

One way to do each thing. `src/modules/users` is the reference implementation.

- **Module layout** — everything a module is lives in `src/modules/<name>/`: `api/` (data access:
  a key factory, `queryOptions`, hooks), `components/` (pages and parts), model files at the root,
  `index.ts` (the barrel other modules import), `pages.ts` (the pages, for its routes only),
  `routes/app/` (its routes inside the signed-in shell) and `routes/public/` (outside it),
  `locales/<lng>/<namespace>.json` (its copy), and `manifest.tsx` (what it adds to the shell).
  Keeping pages out of the barrel stops a page that composes another module from creating an
  import cycle. A route file holds only `createFileRoute`, `staticData: { capability }` when its
  page requires one, its guards (`beforeLoad`, `head`), search validation and the page; the route
  reads params and search and passes them to the page as props.
- **Adding a module** — `bun run new-module <name>` creates a working module from the template
  (`scripts/new-module.mjs`) and adds its id to `src/app/modules.ts`, the one shared line. The
  route tree (`src/app/routes.ts`), manifest registry (`src/app/register.ts`) and catalogues pick
  it up from its folder. `src/__tests__/module-registry.test.ts` holds the wiring.
- **Manifests** — a module adds sidebar entries, palette commands, `g` shortcuts, feature flags
  and other modules' extension points (Qeet AI's `qeetaiSuggestions`) in its `manifest.tsx`
  (`src/platform/modules/manifest.ts`). Never add a module's entry to a platform table.
- **Route capability** — a route states what its page requires (`staticData: { capability }`);
  the access boundary and link checks read it (`src/platform/security/route-capability.ts`). A nav
  entry's `capability` must match its route's (a test holds it).
- **Feature flags** — declared in the owning module's manifest with an `owner`, a `description`
  and an `expires` date (`null` only for a lasting kill switch); a test fails once a date passes,
  and the flag is then removed, keeping the winning path. A deployment turns any flag off at
  runtime with `CONSOLE_FLAGS_OFF=<id>,<id>`, no rebuild.
- **Search params** — a Zod schema as `validateSearch`, built from `searchText()` and
  `searchEnum()` (`src/shared/utils/search-params.ts`), so a blank, stale or unknown value
  becomes undefined instead of failing the route.
- **Query keys** — one factory per module (`userKeys` in `src/modules/users/api/keys.ts`). Every key
  starts `[module, tenantId, …]`, so one organization's entries never mix with another's and a
  prefix refreshes a tenant's lists or one record's views together. Define reads with
  `queryOptions` (`userQueries`) so hooks, prefetches and other modules share one cache entry. A
  mutation refreshes what it changed; its callers don't.
- **Forms** — `useAppForm` from `src/platform/forms/app-form.tsx` (TanStack Form bound to the
  `@qeetrix/ui` fields) with a Zod schema as the `onSubmit` validator. On a refusal call
  `applyServerErrors(formApi, err)` so a 422 marks the fields it names, and render
  `<FormError error={mutation.error} />`; give that mutation `meta: { silentError: true }` so the
  error isn't toasted as well. A settings form keys on the loaded data (`dataUpdatedAt`) and saves
  with `requireChanges`, so a failed load never shows a form of made-up values. Two kinds keep
  their own markup: the signed-out screens (sign-in, sign-up, reset, magic link, invitation),
  whose `auth-*` styling and native fields serve password managers and passkey autofill, and
  state a form can't type, such as the ABAC condition tree, which sits beside its form.
- **Loading and errors** — the platform `DataState` for every query-backed surface. It prints curated
  copy and the request's support reference (`ErrorReference`). Toast a failure with
  `toastError(err)` (`src/platform/errors/error-toast.ts`), never `toast.error(errorMessage(err))`.
- **Confirmations** — a sensitive action through `useSensitiveAction` (rule 7); any other yes/no
  through `useConfirmDialog` (`src/shared/components/confirm-dialog.tsx`). A raw `AlertDialog` is
  only for a dialog with its own content, such as a form or typed confirmation.
- **One-time secrets** — `OneTimeSecret` (`src/shared/components/one-time-secret.tsx`). Keep the
  value in component state only, and give the mutation that returns it `gcTime: 0`.
- **Server wording** — render a fixed set of server values (a verify reason, a check result) by
  mapping each to a key; never print the server's own sentence.
- **Copy and locales** — every user-facing string is a catalogue key: `t()` in a component,
  `i18n.t("<ns>:key")` elsewhere, and a key, not English, in a label table or a mutation's
  `meta.successMessage` (the query client translates it). Brand, protocol and format names, sample
  values, anything sent to the backend or the AI model, and export-file columns stay as they are.
  A module owns its namespaces (usually one, named after it) in its `locales/` folder and
  declares them for typing at the foot of its `manifest.tsx`; the platform owns `common` and
  `errors`. **Keys are typed**: a key no `en` catalogue holds fails the typecheck. A component
  names every namespace it reads (`useTranslation(["users", "common"])`); a key held as data is
  a `TranslationKey` rendered with `i18n.t`; a key built from a value needs the value typed as a
  known set (`isOneOf`), or `translateDynamic` when only the server knows the values. Never cast
  a key (`src/i18n/README.md`, Typed keys). `src/i18n/__tests__/catalogue-keys.test.ts` fails on a
  key missing from `en`, or a section missing for a key built at runtime; `locale-parity.test.ts`
  on a translation English no longer has. Only `OFFERED_LANGUAGES` (`src/i18n/index.ts`) can be chosen:
  a locale is offered once it translates every `en` key, so the console never mixes languages
  (`src/i18n/README.md`).
- **Numbers and dates** — format with `formatLocale()` (`@/i18n`): the reader's locale when it
  shares the console's language (en-IN groups 1,23,456), else the console's, so no date carries
  another language's month names. Words from `Intl` (country names, lists) follow the UI language.
- **File size** — a source file stays within 500 lines (`src/__tests__/source-files.test.ts`).
  Split by cohesion into siblings named `<file>-<part>`, with pure logic in a `.ts` file.
- **TanStack Start stays at 1.168** — pinned exactly with its router: 1.169 removed the `useSession`
  API the session cookie is sealed with, so upgrading is a session migration of its own
  (docs/llm/context.md, CI/CD).
- **Bundle size** — `bun run size` (CI, after the build; `scripts/check-bundle-size.mjs`) holds
  the signed-in shell's initial JS, and each route's own JS beyond its parent's, to the gzip
  budgets in `bundle-budgets.json`. Code only some screens need (an editor, a date picker, a QR
  encoder, the Qeet AI workspace) loads with `React.lazy` where it renders. A route's
  `validateSearch` and `beforeLoad` ship in the entry with everything they import, so they read
  light model files (`tabs.ts`, `time-range.ts`), never a page; and importing a barrel loads what
  it re-exports, so the barrels the shell imports stay light. **Raise a budget only in the change
  that grows the bundle, by hand, to what the check suggests, and give the reason in the commit
  message**; never re-baseline the file to make room. A route without a budget is held to
  `newRoute` until it gets one; a removed route's budget fails the check until deleted.
- **API contract** — no generated client. Each module types the endpoints it calls by hand from
  the server's Go structs and OpenAPI, and parses with a Zod `schema` where a wrong shape would
  mislead (a one-time secret, a status). A server contract change is a cross-repository change
  (see "Escalate rather than proceed").

## Commands

```bash
bun install
bun run dev              # vite dev on port 3002 (see below)
bun run build
bun run test             # vitest
bun run test:coverage    # vitest + coverage thresholds (what CI runs)
bun run test:e2e         # build, then the Playwright suites: session boundary and accessibility
bun run typecheck
bun run check            # biome format + lint + assist
bun run lint:boundaries  # the layering gate
bun run size             # after a build: the gzip budgets in bundle-budgets.json
bun run audit            # known high/critical vulnerabilities in the dependency tree
```

**There is no Makefile.** `VITE_ENABLE_DEVTOOLS=true bun run dev` opts into the TanStack devtools.

> **Local port.** `bun run dev` serves on **3002** (pinned in the `dev` script), matching
> `qeet-id-server`'s `APP_BASE_URL=http://localhost:3002`; it allowlists 3000–3003 + 5173 for
> CORS and WebAuthn. Redirects and passkeys only work on 3002 — don't override the port.

## What CI enforces

`ci.yml` (push to `main`/`develop`/`release/**`, every PR). Every action is pinned to a commit SHA
and workflows default to read-only permissions.

- `verify` (job name **Verify**, the required status check on `main`; 20 min): typecheck → `check`
  → **`lint:boundaries`** → `test:coverage` (thresholds in `vitest.config.ts`) → build →
  **`size`** (the bundle budgets; see Conventions, Bundle size).
- `e2e` (job name **Session E2E**): every Playwright spec in `tests/e2e` against the production
  build: the session boundary, the Content-Security-Policy and the WCAG 2.2 AA accessibility scan
  (rule 12).
- `dependency-review` (PRs only): fails on a new dependency with a high or critical advisory.
- `image` — push to `release/**` only, after `verify`: publishes
  `ghcr.io/qeetgroup/qeet-id-console:sha-<commit>` (amd64+arm64) for the Qeet ID Kit (`qeet-id-kit`).
  It never computes an RC number. The image is the `Dockerfile` (Nitro `node-server`), configured at
  runtime by `SERVER_URL`, `SESSION_SECRET` and `PUBLIC_API_URL`; health `GET /healthz`. Vercel
  production does not use it.
- `image-sbom` and `image-attest` — with `image`: attach SLSA build provenance and the CycloneDX
  SBOM to the image's digest.

`codeql.yml` scans the TypeScript and the workflow files (pushes, PRs, weekly).
`dependency-audit.yml` runs `bun run audit` on pushes, PRs and daily (not a required check).
`docker.yml` builds and smoke-tests the image, and generates the SBOM, on PRs that touch them.
`sbom.yml` (reusable) writes the SBOM: a CycloneDX file of the production dependency tree
(`--omit dev`), read from the installed `node_modules` by a pinned `@cyclonedx/cyclonedx-npm`, as
the `sbom` artifact. `package.json` `overrides`
hold only security floors for transitive packages; never add a version pin there for another reason.
`.github/dependabot.yml` proposes bun, Actions and Docker digest updates weekly, each at least 3
days after release; `bunfig.toml` applies the same 3-day minimum to local `bun add`/`bun update`.

`deploy.yml` runs on every push to `main`: the same gate as Verify, then `vercel build`/`deploy
--prod` (pinned Vercel CLI; the token reaches only the Vercel steps), then it creates the `vX.Y.Z`
tag and GitHub release through the API. Vercel's own Git integration is disabled for
`main` (`vercel.json`) so the two cannot double-deploy; PR and `develop` previews still come
from Vercel. Its `attest` job signs build provenance and the SBOM for `vercel-output.sha256`, the
checksums of every file in `.vercel/output` (the `vercel-output-checksums` artifact; the output
itself is never uploaded, as it was built with the production environment).

**Attestations** use `actions/attest` (`attest-build-provenance` is now a wrapper around it and
`attest-sbom` is deprecated). Only an attest job holds `id-token: write` and `attestations: write`,
and it runs no checkout or dependency code: a package that could mint an OIDC token could sign
anything as this repository. Verify after a run:

```bash
gh attestation verify oci://ghcr.io/qeetgroup/qeet-id-console:sha-<commit> -R qeetgroup/qeet-id-console
gh run download <run-id> -R qeetgroup/qeet-id-console -n vercel-output-checksums
gh attestation verify vercel-output.sha256 -R qeetgroup/qeet-id-console \
  --signer-workflow qeetgroup/qeet-id-console/.github/workflows/deploy.yml
# add --predicate-type https://cyclonedx.org/bom to check the SBOM instead of the provenance
```

Production refuses to serve with a missing or malformed `SESSION_SECRET`, backend URL or public API
URL (`src/platform/config/server-config.ts`, called from `src/start.ts`): every request fails and
the log names the variable. Security response headers live in
`src/platform/security/security-headers.ts` and are applied through Nitro route rules
(`vite.config.ts`) for both the image and Vercel. The Content-Security-Policy is set per response
in `src/start.ts` (`content-security-policy.ts`): scripts run only with that response's nonce,
which the router puts on every script it renders, so **never add an inline `<script>` or event
handler** (use `ScriptOnce`, which carries the nonce), never load code from another origin
(Monaco ships from the console's own bundle), and never relax `script-src` or `connect-src`.
`tests/e2e/content-security-policy.spec.ts` fails on any violation.

## Comments

Comment the *why*, briefly; the code says *what*. Not every line needs a comment.

- **Doc comments** (`/** … */`) go directly above a function, component, hook, class or type whose
  contract isn't obvious from its name and signature, one line or several (editors show them on
  hover). Start with what it does ("Returns…", "Renders…"), at most 4 lines. Add `@param` /
  `@returns` / `@throws` only when they say something the types don't.
- **End-of-line comments** (`//`): a note about one field, property, variable, constant, union
  member or config value goes at the end of that line (`count: number; // events since last
  read`), never on its own line above. Shorten it to fit 100 columns; only a note that can't fit
  stays above.
- **Implementation comments** (`//`) sit above the statements they explain and give a reason: a
  constraint, an invariant, a consequence that isn't visible. One or two lines, three at most.
- **Syntax:** every comment other than a doc comment uses `//`, including empty `catch` blocks;
  never `/* … */`. JSX uses `{/* … */}`, as it has no `//`.
- **File comments** only when the file's role isn't clear from its name: up to 3 `//` lines.
- **Never**: ticket or ADR numbers, dates, history ("previously", "was removed"), lists of
  callers, a restatement of the code, commented-out code, decorative rules, `eslint-` directives
  (Biome is the linter). Keep security rationale, shortened.
- Keep `biome-ignore` reasons to one line. Test names carry the intent; a test comment explains
  only non-obvious setup.

## Commits and pull requests

Commit subject: `<type>(<scope>): <what changed, imperative>`, with `QTID-<n>` before the
summary only when the change already has a ticket — e.g. `fix(auth): QTID-802 say why a social
sign-in was refused`. Work in this repository needs no ticket; raise one only for a change another
repository must make. Types: `feat`, `fix`, `refactor`,
`test`, `docs`, `chore`, `ci`, `security`. One logical change per commit; never a bare
"qeet-id-console". Pull requests follow `.github/pull_request_template.md`.

## Before you finish

```bash
bun run typecheck && bun run check && bun run lint:boundaries && bun run test
git diff
```

After changing `src/platform/{api,auth}` (the session boundary) or anything a page renders, also
run `bun run test:e2e`: it builds, then runs the Playwright suites in `tests/e2e`, including the
accessibility scan. Its ports default to 43173 (app) and 43101 (fake backend); set `E2E_APP_PORT`
and `E2E_BACKEND_PORT` to run two copies side by side.

## Escalate rather than proceed

Weakening the session model · putting a token in the browser · treating a UI capability as
enforcement · bypassing `proxyApiRequest` · relaxing the SSRF guard · editing `routeTree.gen.ts` ·
exempting a route from the route rule in `biome.json` · anything requiring another
repository.
