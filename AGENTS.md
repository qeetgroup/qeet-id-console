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

### 3. Layering is enforced by lint, and CI runs it
```text
routes → modules → platform → shared
```
Biome `noRestrictedImports` overrides in `biome.json` fail the build:
- `src/shared/**` may import only `@/shared`, `@/i18n`, or external packages
- `src/platform/**` may import only `@/platform`, `@/shared`, `@/i18n`
- `src/modules/**` must not import `@/routes`; must reach another module **through its barrel**
  (`@/modules/<name>`), never its internals
- `@/lib` is retired — never import it
- `noImportCycles` is `error`

`bun run lint:boundaries` is a CI step. Two more import rules:
- `src/routes/**` must not import module internals (a module's barrel and its `pages` entry are
  public), `api` from `@/platform/api/client`, or `@tanstack/react-query`: data access belongs to
  the owning module. No route is exempt; never add an override that exempts one.
- `DataState` comes from `@/platform/components/data-state`, never `@qeetrix/ui` (rule 5).

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
otp, …) plus email/IP masking. Never log a raw payload around it.

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
the organization, such as the setup checklist, is scoped.

### 11. The server holds no per-person state in module scope
On the server one module instance serves every concurrent request. The session store ignores
writes there; resolve the session per request (`getServerSession`). Never cache a person's data in a
module-level variable that server code can reach.

## Conventions

One way to do each thing. `src/modules/users` is the reference implementation.

- **Module layout** — `api/` (data access: a key factory, `queryOptions`, hooks), `components/`
  (pages and parts), model files at the root, `index.ts` (the barrel other modules import) and
  `pages.ts` (the pages, for routes only). Keeping pages out of the barrel stops a page that
  composes another module from creating an import cycle. A route file holds only
  `createFileRoute`, its guards (`beforeLoad`, `head`), search validation and the page from
  `@/modules/<name>/pages`; the route reads params and search and passes them to the page as
  props.
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
- **Copy and locales** — screen copy goes through `t()`. Only `OFFERED_LANGUAGES`
  (`src/i18n/index.ts`) can be chosen: a locale is offered once it translates every `en` key, so
  the console never mixes languages (`src/i18n/README.md`).
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
bun run test:e2e         # build, then the Playwright session-boundary suite
bun run typecheck
bun run check            # biome format + lint + assist
bun run lint:boundaries  # the layering gate
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
  → **`lint:boundaries`** → `test:coverage` (thresholds in `vitest.config.ts`) → build.
- `e2e` (job name **Session E2E**): the Playwright session suite against the production build.
- `dependency-review` (PRs only): fails on a new dependency with a high or critical advisory.
- `image` — push to `release/**` only, after `verify`: publishes
  `ghcr.io/qeetgroup/qeet-id-console:sha-<commit>` (amd64+arm64) for the `qeet-id-deploy` test kit.
  It never computes an RC number. The image is the `Dockerfile` (Nitro `node-server`), configured at
  runtime by `SERVER_URL`, `SESSION_SECRET` and `PUBLIC_API_URL`; health `GET /healthz`. Vercel
  production does not use it.

`codeql.yml` scans the TypeScript and the workflow files (pushes, PRs, weekly).
`dependency-audit.yml` runs `bun run audit` on pushes, PRs and daily (not a required check).
`docker.yml` builds and smoke-tests the image on PRs that touch it. `package.json` `overrides`
hold only security floors for transitive packages; never add a version pin there for another reason.
`.github/dependabot.yml` proposes bun, Actions and Docker digest updates weekly, each at least 3
days after release; `bunfig.toml` applies the same 3-day minimum to local `bun add`/`bun update`.

`deploy.yml` runs on every push to `main`: the same gate as Verify, then `vercel build`/`deploy
--prod` (pinned Vercel CLI; the token reaches only the Vercel steps), then it creates the `vX.Y.Z`
tag and GitHub release through the API. Vercel's own Git integration is disabled for
`main` (`vercel.json`) so the two cannot double-deploy; PR and `develop` previews still come
from Vercel.

Production refuses to serve with a missing or malformed `SESSION_SECRET`, backend URL or public API
URL (`src/platform/config/server-config.ts`, called from `src/start.ts`): every request fails and
the log names the variable. Security response headers live in
`src/platform/security/security-headers.ts` and are applied through Nitro route rules
(`vite.config.ts`) for both the image and Vercel.

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

`src/platform/{api,auth}` carries the session boundary: after changing it, also run
`bun run test:e2e` (builds, then runs the Playwright session suite in `tests/e2e`).

## Escalate rather than proceed

Weakening the session model · putting a token in the browser · treating a UI capability as
enforcement · bypassing `proxyApiRequest` · relaxing the SSRF guard · editing `routeTree.gen.ts` ·
exempting a route from the route rule in `biome.json` · anything requiring another
repository.
