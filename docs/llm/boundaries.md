# Boundaries — qeet-id-console

**Level:** L2 · **Last verified:** 2026-08-28
**Verification scope:** ownership from `qeet-id-context/REPOSITORIES.md`; layering rules from
`biome.json`, verified by grep.

## Owns

The operator UI at `console.id.qeet.in` · the same-origin BFF that holds the session · the
capability-driven navigation and page gating · telemetry redaction · user-safe error copy · the
sensitive-action/step-up primitive.

## Does not own

| Not owned | Owner |
|---|---|
| **Every authorization decision** | `qeet-id-server` |
| Tenant scoping, token validation, business rules | `qeet-id-server` |
| The API contract | `qeet-id-server` — see its OpenAPI documents |
| End-user sign-in UI | `qeet-id-login` |
| Marketing | `qeet-id-website` |
| SDKs | `qeet-id-{go,node,react}` |
| Product documentation | `qeet-id-docs` |
| Infrastructure | `qeet-id-deploy` |
| The design system | `qeetrix-ui` — consumed as `@qeetrix/ui` |

## Consumes

`api.id.qeet.in` **through its own BFF** (bearer attached server-side) · `@qeetrix/ui` ·
unauthenticated federation redirects directly from the browser (e.g. social login start).

## Provides

An operator web UI. **No public API, no package.** Its only external contract is the set of
endpoints it calls — so a backend contract change reaches it, not the other way round.

## Internal boundaries — enforced by lint, run in CI

```text
routes  →  modules  →  platform  →  shared
```

| Layer | Rule |
|---|---|
| `src/shared/**` | may import only `@/shared`, `@/i18n`, external packages |
| `src/platform/**` | may import only `@/platform`, `@/shared`, `@/i18n` |
| `src/modules/**` | must not import `@/routes`; reaches another module **only via its barrel** |
| all | `noImportCycles: "error"`; `@/lib` is retired |

`bun run lint:boundaries` is a CI step — a violation fails the build.

## Security boundaries

**The trust boundary is `qeet-id-server`, not this repository.**

| Boundary | Enforcement |
|---|---|
| Browser ↔ tokens | **Tokens never cross.** Encrypted `__Host-` cookie, read server-side only |
| BFF → backend origin | `server-request-policy.ts` — SSRF guard on every proxied path |
| Credential responses | `session-response.ts` allowlist; anything else → `502` |
| Server functions | CSRF middleware in `src/start.ts` |
| Capability → UI | **UX only.** ADR-0003 — the backend decides |
| Backend message → user | `errors/user-message.ts` — the leak stop |
| Payload → telemetry | `telemetry/redact.ts` — denylist + email/IP masking |

> **A UI capability check is not a security boundary.** It hides a button. If hiding the button is
> the only thing preventing an action, that is a defect in `qeet-id-server`.

## Cross-repository dependencies

```text
qeet-id-server ──API contract──►  qeet-id-console
qeetrix-ui     ──@qeetrix/ui───►  qeet-id-console
qeet-id-console ──redirects to──►  qeet-id-login   (OIDC sign-in)
```

This repository is **downstream of everything**. It initiates no contract.

## Safe to change without coordination

UI copy and layout · a new page composed from existing endpoints · styling within `@qeetrix/ui` ·
adding a test · internal refactoring inside one module · i18n strings · feature-flag defaults.

## Requires cross-repository coordination

| Change | Reaches |
|---|---|
| **Calling a new endpoint** | Requires the endpoint to exist in `qeet-id-server` first |
| **Session or cookie assumptions** | `qeet-id-server` sets them |
| **CSRF cookie/header names** | Must match `qeet-id-server` and `qeet-id-login` |
| A new permission surfaced in the UI | `qeet-id-server` must define it |
| Error-code handling | `qeet-id-server` owns the codes |
| `@qeetrix/ui` major upgrade | `qeetrix-ui` — currently pinned `^1.0.3` against npm `2.0.0` |
| Hostname change | `qeet-id-deploy`, backend CORS, WebAuthn origins |

Product-level fan-out: `qeet-id-context/CHANGE-MATRIX.md`.

## Hard limits

1. **Never put a token in the browser** — not in state, not in storage, not in a server-function
   return. ADR-0009.
2. **Never treat a UI capability as enforcement.** ADR-0003.
3. **Never bypass `proxyApiRequest`** — no direct `fetch` to the backend from a component.
4. **Never relax the SSRF guard** in `server-request-policy.ts`.
5. **Never render a backend `error.message`** — use `userMessageForCode`.
6. **Never log an unredacted payload.**
7. **Never hand-edit `src/routeTree.gen.ts`** — it is generated and marked read-only.
8. **Never import across a layer boundary** — lint will fail, and the rule exists to keep the
   extraction seams intact.
9. **Never reintroduce `localStorage` token keys** — ADR-0002 is superseded and actively purged.
10. **Never change another repository** from a task scoped to this one.
