# Boundaries — qeet-id-console

**Level:** L2 · **Last verified:** 2026-10-23
**Verification scope:** ownership from `qeet-id-context/REPOSITORIES.md`; layering rules from
`biome.json` and `src/__tests__/module-boundaries.test.ts`, verified by grep.

## Owns

The operator UI at `console.id.qeet.in` · the same-origin BFF that holds the session · the
capability-driven navigation and page gating · telemetry redaction · user-safe error copy · the
sensitive-action/step-up primitive.

## Does not own

| Not owned | Owner |
|---|---|
| **Every authorization decision** | `qeet-id-server` |
| Tenant scoping, token validation, business rules | `qeet-id-server` |
| The API contract | `qeet-id-server` — see its OpenAPI documents; the console types what it calls by hand (no generated client) |
| End-user sign-in UI | `qeet-id-hosted` (`accounts.id.qeet.in`) |
| Marketing | `qeet-id-website` |
| SDKs | `qeet-id-{go,node,react}` |
| Product documentation | `qeet-id-docs` |
| Infrastructure | `qeet-id-deploy` |
| The design system | `qeetrix-react`, `qeetrix-tokens`, `qeetrix-icons` — consumed as `@qeetrix/react`, `@qeetrix/tokens`, `@qeetrix/icons` |

## Consumes

`api.id.qeet.in` **through its own BFF** (bearer attached server-side) · `@qeetrix/react` ·
unauthenticated federation redirects directly from the browser (e.g. social login start).

## Provides

An operator web UI. **No public API, no package.** Its only external contract is the set of
endpoints it calls — so a backend contract change reaches it, not the other way round.

## Internal boundaries — enforced by lint and tests, run in CI

```text
app  →  modules  →  platform  →  shared
```

| Layer | Rule |
|---|---|
| `src/shared/**` | may import only `@/shared`, `@/i18n`, external packages |
| `src/platform/**` | may import only `@/platform`, `@/shared`, `@/i18n`; reads modules only through the registry `src/app` fills |
| `src/modules/**` | must not import `@/routes` or `@/app`; reaches another module **only via its barrel** |
| route files (`src/modules/*/routes/**`, `src/routes/**`) | module barrels and `pages` entries only; never module internals, `api()` or `@tanstack/react-query` (no exemptions) |
| `src/app/**` | the composition root; may import anything, and only the router, Vite config and test setup import it |
| all | `noImportCycles: "error"`; `@/lib` is retired; no import climbs more than one folder (`@/` instead) |

`bun run lint:boundaries` is a CI step, and so is the test suite that holds the barrel and
relative-import rules — a violation fails the build. A module's catalogue namespaces are its own:
`locale-parity.test.ts` fails when two modules claim one.

## Security boundaries

**The trust boundary is `qeet-id-server`, not this repository.**

| Boundary | Enforcement |
|---|---|
| Browser ↔ tokens | **Tokens never cross.** Encrypted `__Host-` cookie, read server-side only |
| BFF → backend origin | `server-request-policy.ts` — SSRF guard on every proxied path |
| Credential responses | `session-response.ts` allowlist; anything else → `502` |
| Server functions, unsafe server-route requests | CSRF middleware in `src/start.ts`, policy in `src/platform/security/csrf-policy.ts` (tested) |
| Browser storage | `src/platform/auth/scoped-storage.ts` — per person and tenant, wiped on sign-out |
| Response headers | `src/platform/security/security-headers.ts` — HSTS, `X-Frame-Options`, nosniff, Referrer-Policy, Permissions-Policy, `X-Robots-Tag` |
| Scripts the browser runs | `src/platform/security/content-security-policy.ts`, set per response in `src/start.ts` — a nonce on every script, `'strict-dynamic'`, no eval, `connect-src 'self'`, no framing; Monaco is self-hosted |
| Capability → UI | **UX only.** The backend decides |
| Backend message → user | `errors/user-message.ts` — the leak stop |
| Payload → telemetry | `telemetry/redact.ts` — denylist + token/query/email/IP masking; production telemetry goes only to the console's own server log |
| Browser → server log | `telemetry/client-report.ts` — a server function (CSRF-checked) with a strict Zod allowlist and bounds |
| Server log → browser bundle | `server-log.ts` imports `@tanstack/react-start/server-only`: the build fails if it would ship |

> **A UI capability check is not a security boundary.** It hides a button. If hiding the button is
> the only thing preventing an action, that is a defect in `qeet-id-server`.

## Cross-repository dependencies

```text
qeet-id-server ──API contract──►  qeet-id-console
qeetrix-react  ──@qeetrix/react►  qeet-id-console
qeet-id-console ──redirects to──►  qeet-id-hosted  (OIDC sign-in)
```

This repository is **downstream of everything**. It initiates no contract.

## Safe to change without coordination

UI copy and layout · a new page composed from existing endpoints · styling with `--qx-*` tokens ·
adding a test · internal refactoring inside one module · i18n strings · feature-flag defaults.

## Requires cross-repository coordination

| Change | Reaches |
|---|---|
| **Calling a new endpoint** | Requires the endpoint to exist in `qeet-id-server` first |
| **Session or cookie assumptions** | `qeet-id-server` sets them |
| **CSRF cookie/header names** | Must match `qeet-id-server` and `qeet-id-hosted` |
| A new permission surfaced in the UI | `qeet-id-server` must define it |
| Error-code handling | `qeet-id-server` owns the codes |
| `@qeetrix/react` / `@qeetrix/tokens` / `@qeetrix/icons` upgrade | `qeetrix-react`, `qeetrix-tokens`, `qeetrix-icons` — pinned exactly (`0.1.1` / `0.0.9` / `1.0.12`); bump deliberately and read the changelog |
| Hostname change | `qeet-id-deploy`, backend CORS, WebAuthn origins |

Product-level fan-out: `qeet-id-context/CHANGE-MATRIX.md`.

## Hard limits

1. **Never put a token in the browser** — not in state, not in storage, not in a server-function
   return.
2. **Never treat a UI capability as enforcement.**
3. **Never bypass `proxyApiRequest`** — no direct `fetch` to the backend from a component.
4. **Never relax the SSRF guard** in `server-request-policy.ts`.
5. **Never render a backend `error.message`** — use `userMessageForCode`.
6. **Never log an unredacted payload.**
7. **Never hand-edit `src/routeTree.gen.ts`** — it is generated and marked read-only.
8. **Never import across a layer boundary** — lint will fail, and the rule exists to keep the
   extraction seams intact.
9. **Never reintroduce `localStorage` token keys** is superseded and actively purged.
   Person or tenant data in browser storage goes only through `scopedStorage`.
10. **Never change another repository** from a task scoped to this one.
