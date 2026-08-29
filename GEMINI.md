# GEMINI.md — qeet-id-console

**Read [AGENTS.md](AGENTS.md) first.** It is the model-neutral instruction file and the source of
truth for this repository. This file is a pointer and adds no architecture.

```text
GEMINI.md  →  AGENTS.md  →  docs/llm/*
```

## Canonical context

| File | For |
|---|---|
| [qeet-repo.yml](qeet-repo.yml) | Machine-readable repository identity |
| [AGENTS.md](AGENTS.md) | **Rules, commands, what CI enforces** |
| [docs/llm/context.md](docs/llm/context.md) | How this repository actually works |
| [docs/llm/subsystems.md](docs/llm/subsystems.md) | Subsystem map + real filenames |
| [docs/llm/boundaries.md](docs/llm/boundaries.md) | What it owns, and what it must not touch |
| [docs/llm/workflows.md](docs/llm/workflows.md) | Step-by-step for common changes |
| [docs/llm/architecture-map.md](docs/llm/architecture-map.md) | "Where is X?" — fastest path to a file |

Parent context: **L0** `qeetgroup/qeet-context` · **L1** `qeetgroup/qeet-id-context`.

## What this repository is

The **operator console for Qeet ID** (`console.id.qeet.in`). TanStack Start + Router, React 19, Vite 8 + Nitro, Tailwind v4, `@qeetrix/ui`, bun. It has a **server side**: TanStack Start is a same-origin BFF that holds the session, so backend tokens never reach the browser.

## Non-negotiables

1. **The backend is the authority** (ADR-0003). Client capabilities are UX only — never re-implement RBAC/ABAC in the browser.
2. **Tokens never reach the browser** (ADR-0009). They live in an encrypted, chunked `__Host-qeet_console` cookie read server-side. Never add one to client state or `localStorage`.
3. **All backend traffic goes through `src/platform/api/client.ts` → `proxyApiRequest`.** Never `fetch` the backend from a component.
4. **Never render a backend `error.message`** — use `userMessageForCode`. Never log an unredacted payload.
5. **Never relax the SSRF guard** in `server-request-policy.ts`, and never exempt a server function from CSRF.
6. **Never hand-edit `src/routeTree.gen.ts`**, and never import across a layer boundary.

## Commands

`bun run dev` · `bun run build` · `bun run test` · `bun run typecheck` · `bun run check` · `bun run lint:boundaries`

That list is complete — **do not invent commands.**

## Before finishing

```bash
bun run typecheck && bun run check && bun run lint:boundaries && bun run test
# src/platform/{api,auth} has no browser-level test cover - verify the session boundary by hand
git diff
```
