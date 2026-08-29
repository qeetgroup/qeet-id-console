# GitHub Copilot — qeet-id-console

**Canonical instructions: [`AGENTS.md`](../AGENTS.md).** This file is a summary; it adds no
architecture.

## Repository

The **operator console for Qeet ID** (`console.id.qeet.in`). TanStack Start + Router, React 19, Vite 8 + Nitro, Tailwind v4, `@qeetrix/ui`, bun. It has a **server side**: TanStack Start is a same-origin BFF that holds the session, so backend tokens never reach the browser.

Context: **L0** `qeet-context` (organization) → **L1** `qeet-id-context` (product) → **L2** this
repository → source.

## Structure

Layered and **lint-enforced**: `routes → modules → platform → shared`. 14 modules under `src/modules/` (reachable only through their barrels), 9 dirs under `src/platform/`. Biome `noRestrictedImports` + `noImportCycles` fail the build; CI runs `bun run lint:boundaries`. **`src/app/` does not exist** despite the README. `src/routeTree.gen.ts` is generated and read-only.

## Rules

1. **The backend is the authority** (ADR-0003). Client capabilities are UX only — never re-implement RBAC/ABAC in the browser.
2. **Tokens never reach the browser** (ADR-0009). They live in an encrypted, chunked `__Host-qeet_console` cookie read server-side. Never add one to client state or `localStorage`.
3. **All backend traffic goes through `src/platform/api/client.ts` → `proxyApiRequest`.** Never `fetch` the backend from a component.
4. **Never render a backend `error.message`** — use `userMessageForCode`. Never log an unredacted payload.
5. **Never relax the SSRF guard** in `server-request-policy.ts`, and never exempt a server function from CSRF.
6. **Never hand-edit `src/routeTree.gen.ts`**, and never import across a layer boundary.

## Commands

`bun run dev` · `bun run build` · `bun run test` · `bun run typecheck` · `bun run check` · `bun run lint:boundaries`

## Do not

- store a token in the browser, in state, or in localStorage
- treat a UI capability check as an enforcement boundary
- call the backend directly from a component — go through `api()`
- render a raw backend error message to the user
- hand-edit `src/routeTree.gen.ts`
- import across a layer boundary — lint will fail
