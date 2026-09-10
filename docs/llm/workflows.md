# Workflows — qeet-id-console

**Level:** L2 · **Last verified:** 2026-08-28
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
2  route file                src/routes/_app/<area>/<page>.tsx
3  navigation entry          src/platform/config/navigation.tsx — sets the required capability
4  data access               a module's api/ dir, NEVER fetch from the component
5  compose                   import the module through its BARREL: @/modules/<name>
6  i18n                      add strings; en is required, others fall back
7  test
8  bun run typecheck && bun run check && bun run lint:boundaries && bun run test
```

**The navigation entry is what gates the page.** `getRequiredCapabilityForPath` reads it, and
`AccessBoundary` enforces it in the UI. Both are UX — the backend still decides.

## Call a new endpoint

```text
1  VERIFY IT EXISTS in qeet-id-server — never invent one
2  add a function in the module's api/ dir
3  call api(path, opts) from src/platform/api/client.ts — the ONLY request path
4  optional: pass a Zod `schema` to fail closed on contract drift (ADR-0007)
5  map errors through the module; never render error.message
6  test
```

**If the endpoint issues credentials**, it must be in the allowlist in
`src/platform/auth/session-response.ts`, or the BFF will reject it with
`502 client.unexpected_token_response`. That is deliberate.

## Add or change a module

```text
1  src/modules/<name>/ with api/ + components/ + index.ts BARREL
2  the barrel is the module's public surface — other modules may import ONLY it
3  do not import @/routes from a module
4  bun run lint:boundaries      ← the gate
```

`compliance` and `dashboard` currently have **no barrel**, so nothing can import them. Adding one is
the fix if you need to.

## Change session or auth behaviour

**Security review required.**

```text
1  src/platform/auth/server-session.ts   (cookie, sealing, PublicSession)
   src/platform/api/server-proxy.ts      (bearer, refresh, single-flight)
   src/platform/auth/session-response.ts (token-issuing allowlist)
2  TOKENS MUST NOT REACH THE BROWSER — ADR-0009
3  keep unseal failures FAIL-CLOSED (clear the session, return {})
4  test/unit only — NO browser-level cover; verify this invariant by hand
```

Never add a token to `PublicSession`. Never reintroduce localStorage token keys.

## Change authorization surfacing

```text
1  src/platform/security/capability-model.ts   (the 25 capabilities)
2  src/platform/config/navigation.tsx          (path → capability)
3  remember: UX ONLY. The backend decides — ADR-0003
4  a new capability must exist in qeet-id-server first
5  test capability-model + navigation
```

**Never re-implement RBAC/ABAC evaluation in the browser.**

## Add a sensitive action

```text
1  use useSensitiveAction() — do NOT hand-roll a confirm dialog
2  it gives: capability pre-check (UX) → confirm → step-up → retry once
3  a backend 403 step_up_required opens the re-auth dialog automatically
4  RequireRecentMFA on the backend stays authoritative
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

If you touched `src/platform/{api,auth}`, verify the session boundary manually — there is no
automated browser test for it. Sign in and confirm: no token in `localStorage` or `document.cookie`,
the session cookie is HttpOnly + `SameSite=Lax`, and the session survives a hard refresh.

### Escalate rather than proceed

A token in the browser · treating a capability as enforcement · bypassing `proxyApiRequest` ·
relaxing the SSRF guard or CSRF · calling an endpoint that does not exist · editing the generated
route tree · anything requiring another repository.
