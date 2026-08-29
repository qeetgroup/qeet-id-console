# Qeet ID Console

The operator control plane for Qeet ID. It serves identity administrators, security teams, and platform engineers managing tenants, users, authentication, authorization, audit, compliance, and developer integrations.

## Product direction

The console uses an institutional enterprise language rather than stock shadcn styling:

- high information density with clear operational hierarchy;
- cool neutral surfaces with Qeet orange reserved for primary intent;
- a persistent dark control rail in both themes;
- data-first panels, metric rails, and dividers instead of grids of identical cards;
- visible loading, empty, error, focus, hover, active, and reduced-motion states;
- WCAG 2.2 AA contrast targets and semantic status colours;
- desktop operator efficiency without sacrificing touch and mobile access.

The shared `@qeetrix/ui` package remains the component foundation. Console-specific product character lives in `src/styles.css`; do not fork Qeetrix primitives or add local shadcn copies.

## Stack

- TanStack Start and TanStack Router file-based routes
- React 19 with React Compiler
- TanStack Query for server state
- Tailwind CSS 4 through the Vite plugin
- Qeetrix UI for accessible primitives and design tokens
- Recharts through Qeetrix chart wrappers
- i18next for localization
- Vitest for unit tests
- Bun workspaces from the repository root

## Architecture

Layered, with the dependency direction enforced in CI (`bun run lint:boundaries`).
Full detail in [`docs/architecture/target-architecture.md`](docs/architecture/target-architecture.md)
and the decision records in [`docs/adr/`](docs/adr/).

```text
src/
├── app/            Bootstrap / providers
├── routes/         File-based routes — URL concerns + composition only
├── modules/        One folder per business capability (authentication,
│                   authorization, billing, compliance, dashboard, developer,
│                   onboarding, organizations, qeetai, security, users, activity,
│                   timeline, search). Each: api/ components/ hooks/ store/ utils/
├── platform/       Cross-cutting infrastructure: api (the one HTTP client), auth
│                   (server-session/session-store), errors, query, security, telemetry,
│                   feature-flags, config (env + navigation), components
├── shared/         Generic, domain-agnostic: components/ hooks/ utils/ data/
├── i18n/           Namespaced locale resources
├── router.tsx      Router + query integration
└── styles.css      Console semantic theme and product-level patterns
```

### Boundaries (enforced)

```text
app → routes → modules → platform → shared
```

1. **Routes own URL concerns** — validate search params, guards, page composition; no reusable logic.
2. **Modules own product capability** — a module imports another module only via its public barrel (`@/modules/<name>`), never its internals.
3. **Platform owns cross-cutting infrastructure** — the HTTP client, session, errors, security, telemetry, feature flags, config. Imports only platform + shared.
4. **Shared owns generic primitives** — no domain-specific imports.
5. **Qeetrix owns UI primitives** (`@qeetrix/ui`); **console CSS owns identity** (`styles.css`).

Violations (wrong-direction imports, cross-module internals, import cycles) fail CI via Biome.

## Enterprise shell

`routes/_app.tsx` is the authenticated shell boundary. It composes:

- `AppSidebar` for workspace context and domain navigation;
- `ConsoleHeader` for breadcrumbs, command search, notifications, preferences, and account access;
- one semantic `main` content landmark with a skip link;
- command-palette and shortcut dialogs at shell scope.

The sidebar account menu was intentionally removed. Account actions live in one predictable location in the top bar. The navigation rail uses real route state rather than a static active flag and keeps parent branches active on detail routes.

## Session boundary

TanStack Start is the same-origin BFF. Backend access and refresh tokens remain
inside an encrypted `HttpOnly` cookie and are never returned to browser code.
Protected layouts resolve the session in `beforeLoad`; JSON requests and SSE
streams inherit backend bearer authentication, refresh rotation, correlation,
safe error handling, and CSRF protection from the platform boundary. See
[`ADR-0009`](docs/adr/0009-server-resolved-bff-session.md).

## Dashboard command center

The overview route is deliberately thin. `features/dashboard/components/dashboard-overview.tsx` coordinates data and composes dedicated modules:

- `dashboard-metrics.tsx` — primary metric rail and secondary directory indicators;
- `dashboard-charts.tsx` — authentication, method-mix, MFA, and failed-login telemetry;
- `dashboard-activity.tsx` — recent audit events and operator actions;
- `dashboard-panel.tsx` — a shared, accessible data-surface boundary;
- `dashboard-model.ts` — testable formatting and transformation logic;
- `use-dashboard-activity.ts` — the independently refreshed audit stream.

The analytics overview remains one backend round trip. Recent activity refreshes independently every 15 seconds. Charts include text labels and hidden table alternatives so colour and pointer interaction are not the only ways to read data.

## Styling rules

- Use semantic tokens such as `bg-card`, `text-muted-foreground`, `text-success`, and `border-border`.
- Reserve `primary` for the current navigation indicator and primary actions.
- Use red, amber, green, and blue only for destructive, warning, success, and informational meaning.
- Use `enterprise-panel`, `dashboard-metric-rail`, and the other named application patterns before inventing one-off surface classes.
- Keep numbers tabular and use the bundled Fira Code only for identifiers and compact telemetry.
- Motion must explain state or hierarchy, use transform/opacity where possible, and honor `prefers-reduced-motion`.
- Do not restore a wall of equal elevated cards. Prefer rails, grouped rows, dividers, or asymmetric data panels.

## Responsive behavior

- Mobile: one-column content, 44-pixel shell targets, off-canvas navigation, and horizontally safe tables.
- Tablet: two-column metric rails and selectively stacked data panels.
- Desktop: persistent 280-pixel navigation and a bounded 1680-pixel workspace canvas.
- Wide desktop: 12-column dashboard composition for primary telemetry and supporting controls.

Validate at 375, 768, 1024, 1440, and 1600 pixels in both themes.

## Development

Prerequisites: [Bun](https://bun.sh) `1.3+` and a running Qeet ID backend
([`qeet-id-server`](https://github.com/qeetgroup/qeet-id-server), local default `:4001`).

```bash
bun install
cp .env.example .env.local     # set VITE_API_URL if not using the default
bun run dev                    # Vite dev server
```

Other scripts:

```bash
bun run build       # production build (Vite + Nitro)
bun run typecheck   # tsc --noEmit
bun run test        # vitest
bun run lint        # biome
```

The TanStack devtools launcher is hidden by default so it never competes with operator UI —
opt in only when debugging:

```bash
VITE_ENABLE_DEVTOOLS=true bun run dev
```

## Configuration

`VITE_*` values are exposed to the browser (inlined at build time). `SERVER_URL`
and `SESSION_SECRET` are server-only. Schema lives in `src/platform/config/env.ts`.

| Variable | Scope | Dev | Prod |
|---|---|---|---|
| `VITE_API_URL` | client | `http://localhost:4001` | `https://api.id.qeet.in` |
| `SERVER_URL` | server (SSR) | falls back to `VITE_API_URL` | `https://api.id.qeet.in` |
| `SESSION_SECRET` | server | development-only fallback | required, random 32+ characters |
| `VITE_APP_TITLE` | client | `Qeet ID Admin` | `Qeet ID Admin` |

## Deployment (Vercel)

Deployed as a **TanStack Start** project on Vercel. It is SSR via Nitro, so the build emits
Vercel's Build Output API (`.vercel/output`) — the dashboard's "Output Directory" field is
ignored, and no framework config is needed. [`vercel.json`](vercel.json) only pins the Bun
install/build commands:

```json
{ "installCommand": "bun install --frozen-lockfile", "buildCommand": "bun run build" }
```

**Steps**

1. Import `qeetgroup/qeet-id-console` in Vercel — the Framework Preset auto-detects **TanStack Start**.
2. Environment variables (Production + Preview):
   ```
   VITE_API_URL=https://api.id.qeet.in
   SERVER_URL=https://api.id.qeet.in
   SESSION_SECRET=<at-least-32-random-characters>
   VITE_APP_TITLE=Qeet ID Admin
   ```
3. Deploy.
4. Add the custom domain **`console.id.qeet.in`** → create the CNAME Vercel provides in GoDaddy
   (`console.id` → `cname.vercel-dns.com`). That host is already in the backend's `ALLOWED_ORIGINS`.

`@qeetrix/ui` resolves from the public npm registry, so a standalone install needs no monorepo.

## Related repositories

| Repo | Role |
|---|---|
| [`qeet-id-server`](https://github.com/qeetgroup/qeet-id-server) | Backend API (Go) — auth, OIDC, WebAuthn |
| [`qeet-id-login`](https://github.com/qeetgroup/qeet-id-login) | Hosted login — `login.id.qeet.in` |
| [`qeet-id-website`](https://github.com/qeetgroup/qeet-id-website) | Marketing site — `id.qeet.in` |
| `qeet-id-deploy` | Backend infrastructure + CD (Terraform) |

Part of the [Qeet Group](https://github.com/qeetgroup) suite; built on the shared `@qeetrix/ui` design system.
