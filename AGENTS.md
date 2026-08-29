# AGENTS.md — qeet-id-console

**The model-neutral instruction file for coding agents.** [CLAUDE.md](CLAUDE.md),
[GEMINI.md](GEMINI.md) and [.github/copilot-instructions.md](.github/copilot-instructions.md) point
here and add nothing architectural.

## What this repository is

The **operator console for Qeet ID** — `console.id.qeet.in`. TanStack Start + TanStack Router,
React 19, Vite 8 + Nitro, Tailwind v4, `@qeetrix/ui`, bun. ~65k LOC across 14 modules.

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
| [docs/llm/subsystems.md](docs/llm/subsystems.md) | The 14 modules + platform, with real paths |
| [docs/llm/boundaries.md](docs/llm/boundaries.md) | Layering rules and what must not change |
| [docs/llm/workflows.md](docs/llm/workflows.md) | Step-by-step for common changes |

Repository ADRs: `docs/adr/` — nine. `docs/engineering-standards.md` has 42 numbered rules.

## Rules

### 1. The backend is the authority — ADR-0003
**Client capabilities are UX only.** Never re-implement RBAC/ABAC evaluation in the browser. Hiding
a button is a convenience; the API rejecting the request is the control. If hiding a button is the
only thing preventing an action, that is a **backend** defect.

`SECURITY.md` opens with it: *"The backend is always the authority."*

### 2. Tokens never reach the browser — ADR-0009
The access/refresh pair lives in an encrypted, chunked `__Host-qeet_console` cookie, read only
server-side. The browser gets `PublicSession` — no tokens. **Never add a token to client state,
`localStorage`, or a server-function return value.**

`src/platform/auth/session-store.ts` actively purges the legacy `qeetid.access_token` keys on
startup. Do not reintroduce them (ADR-0002 is superseded and retained as the record of why).

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

`bun run lint:boundaries` is a CI step. **Note the lint messages still say "features/" — stale
wording from before the rename to `modules/`.**

### 4. All API traffic goes through one path
`src/platform/api/client.ts` → server function `proxyApiRequest` → backend. **This is the only place
requests leave the app.** Correlation IDs, schema parsing and telemetry are added there so every
caller inherits them. Do not call `fetch` to the backend from a component.

### 5. Never render a backend `error.message`
`src/platform/errors/user-message.ts` is "the leak stop" — backend messages may carry internal
context. Map a code to safe copy via `userMessageForCode`.

### 6. Redact telemetry
`src/platform/telemetry/redact.ts` has a hard denylist (token, secret, password, cookie, api-key,
otp, …) plus email/IP masking. Never log a raw payload around it.

### 7. Sensitive actions go through the shared primitive — ADR-0005
`useSensitiveAction()` gives one capability → confirm → step-up → retry path. Backend
`RequireRecentMFA` stays authoritative. Do not hand-roll a confirm dialog for a sensitive mutation.

### 8. Runtime schemas are opt-in — ADR-0007
Pass `schema` to `api()` at boundaries you care about. A mismatch throws
`client.schema_mismatch` — **fail closed rather than hand garbage to the UI.**

### 9. `routeTree.gen.ts` is generated
2,201 lines, committed, and marked read-only in `.vscode/settings.json`. **Never hand-edit it.**

## Commands

```bash
bun install
bun run dev              # vite dev — NO port is configured; Vite defaults to 5173
bun run build
bun run test             # vitest
bun run typecheck
bun run check            # biome format + lint + assist
bun run lint:boundaries  # the layering gate
```

**There is no Makefile.** `VITE_ENABLE_DEVTOOLS=true bun run dev` opts into the TanStack devtools.

> **Local port caveat.** Nothing in this repo sets a dev port, but `qeet-id-server`'s `.env.example`
> sets `APP_BASE_URL=http://localhost:3002` and allowlists 3000–3003 + 5173 for CORS and WebAuthn.
> For redirects and passkeys to work locally, run the console on **3002**:
> `bun run dev -- --port 3002`.

## What CI enforces

`ci.yml`, one job (`verify`, runner `ubuntu-latest`, 15 min): typecheck → `check` →
**`lint:boundaries`** → test → build.

`deploy.yml` runs on every push to `main`: the same gate, then `vercel build`/`deploy --prod`,
then it tags `vX.Y.Z` and cuts a GitHub release. Vercel's own Git integration is disabled for
`main` (`vercel.json`) so the two cannot double-deploy; PR and `develop` previews still come
from Vercel.

## Before you finish

```bash
bun run typecheck && bun run check && bun run lint:boundaries && bun run test
git diff
```

`src/platform/{api,auth}` carries the ADR-0009 session boundary and has no browser-level test
cover, so changes there need manual verification: sign in, confirm no token appears in
`localStorage` or `document.cookie`, and confirm the session survives a hard refresh.

## Escalate rather than proceed

Weakening the session model · putting a token in the browser · treating a UI capability as
enforcement · bypassing `proxyApiRequest` · relaxing the SSRF guard · editing `routeTree.gen.ts` ·
anything requiring another repository.
