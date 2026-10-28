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
Full detail in [`docs/llm/`](docs/llm/) — start with [`context.md`](docs/llm/context.md).

```text
src/
├── app/            The composition root: the module list (modules.ts), the route tree
│                   (routes.ts) and manifest registration (register.ts)
├── routes/         The shell's routes: __root.tsx, the _app layout, healthz, api/ (SSE)
├── modules/        One folder per business capability (18): account, activity,
│                   authentication, authorization, billing, branding, compliance,
│                   dashboard, developer, directory, groups, onboarding, organizations,
│                   qeetai, search, security, timeline, users. Each: api/ components/
│                   routes/ locales/, a manifest.tsx (what it adds to the shell), an
│                   index.ts barrel and a pages.ts
├── platform/       Cross-cutting infrastructure: api (the one HTTP client), auth
│                   (server-session, session-store, scoped-storage), errors, query,
│                   security (capabilities, route capability, step-up, response headers),
│                   telemetry, modules (manifest type + registry), feature-flags,
│                   keyboard, forms, config (env, server config, sidebar), components,
│                   theme
├── shared/         Generic, domain-agnostic: components/ hooks/ utils/ data/
├── i18n/           i18next setup and the platform's common/errors catalogues
├── router.tsx      Router + query integration
└── styles.css      Console semantic theme and product-level patterns
```

`bun run new-module <id>` creates a module from the template and registers it.

### Boundaries (enforced)

```text
app → modules → platform → shared
```

0. **App composes** — it lists the modules and wires their routes, manifests and catalogues; nothing but the router imports it.
1. **Routes own URL concerns** — each module's `routes/` validates search params, declares the page's capability, guards and composes the page; no reusable logic. Lint rejects module internals, `api()` and React Query in route files, with no exemptions.
2. **Modules own product capability** — a module imports another module only via its public barrel (`@/modules/<name>`), never its internals.
3. **Platform owns cross-cutting infrastructure** — the HTTP client, session, errors, security, telemetry, feature flags, config. Imports only platform + shared; it reads modules only through the manifest registry.
4. **Shared owns generic primitives** — no domain-specific imports.
5. **Qeetrix owns UI primitives** (`@qeetrix/ui`); **console CSS owns identity** (`styles.css`).

Violations (wrong-direction imports, cross-module internals, import cycles, direct `fetch`) fail CI via Biome and `src/__tests__/module-boundaries.test.ts`.

## Enterprise shell

`routes/_app.tsx` is the authenticated shell boundary. It renders `ConsoleFrame`
(`modules/dashboard/components/frame`), the `@qeetrix/react` `AppShell`:

- the top bar: Qeet ID, the organisation's name, search (⌘K), Qeet AI and the account menu
  (switching organisation, account, theme, shortcuts, sign out);
- the navigation, one entry per area that opens to its pages; a page's sub-pages are its tabs;
- the Notifications and Help panels on the end edge;
- one `main` landmark with the shell's skip link, and the search palette and shortcuts dialog.

Pages not yet rebuilt keep their own header and spacing, under a band with their breadcrumb and
sub-page tabs.

## Session boundary

TanStack Start is the same-origin BFF. Backend access and refresh tokens remain
inside an encrypted `HttpOnly` cookie and are never returned to browser code.
Protected layouts resolve the session in `beforeLoad`; JSON requests and SSE
streams inherit backend bearer authentication, refresh rotation, correlation,
safe error handling, and CSRF protection from the platform boundary. See
[`docs/llm/context.md`](docs/llm/context.md#the-bff--how-a-request-reaches-the-backend).

## Dashboard command center

The Dashboard (`/`) is rebuilt on `@qeetrix/react`: `modules/dashboard/components/overview/`. It
is the console's one overview: the areas have none, and their old overview URLs redirect to each
area's main page. `overview-page.tsx` reads each source the person may see (the directory, groups,
authorization and people through `use-directory-insights.ts`), and passes it to the panels:

- `overview-pulse.tsx`: four measures across the top, each with a sparkline; two-step coverage
  on a meter with its target;
- `overview-sign-ins.tsx`: sign-ins against failed sign-ins over 14 days (with a table view),
  and each sign-in method's share and its own 14-day line;
- `overview-attention.tsx`: what needs attention, most severe first, each with its one action;
- `overview-security.tsx`: the last 24 hours of failed sign-ins with their bursts marked, and
  two-step coverage as a gauge;
- `overview-people.tsx`: weekly active people, and the applications people use;
- `overview-activity.tsx`: the latest events (`use-dashboard-activity.ts`, refreshed live);
- `overview-organisation.tsx`: departments and their teams as a treemap, and where people work;
- `overview-setup.tsx`: the organisation's set-up as a checklist;
- `overview-parts.tsx`: the ruled panels and four small charts the library doesn't have yet
  (proposals for `@qeetrix/react`).

The rules behind the numbers are plain functions with their own tests: `overview-model.ts` (what
needs attention, bursts, axes, app usage), `overview-setup-model.ts` (the checklist) and
`overview-directory-model.ts` (the directory's and authorization's alerts, the LDAP and Groups items,
the organisation's shape and the treemap layout). The page only reads: loading it never changes
the organisation.

## Users list

Directory › Users (`/users`) is rebuilt on `@qeetrix/react`: `modules/users/components/people/`.

- `people-page.tsx`: the header (breadcrumb, actions, the band, the tabs), the table and its
  pager, and the add, edit and set-password sheets;
- `people-band.tsx`: the key numbers in the header, above the tabs: people over 15 months, two-step
  coverage against its target, when people were last active, and what needs a look. Each part
  links to the list filtered to it;
- `people-toolbar.tsx`: search, then role, department, two-step and last active, with counts;
  what's applied shows as tags;
- `people-table.tsx`: the columns and a row's menu; `people-bulk.tsx`: the selection's actions,
  five requests at a time.

The search and filters live in the address (`?q=&role=&dept=&twostep=&seen=&look=`), so a view can
be shared. `/v1/users` can't filter or count yet (QTID-960), so the page reads everyone, 200 at a
time, up to 2,000 people (`userQueries.directory`), and works over them in `people-model.ts`.
Above 2,000 it says the search, filters and counts cover the first 2,000 only. A rebuilt page with
sub-pages draws them with `PageTabs`, `PageTabList` and `PageBreadcrumb` from `@/modules/dashboard`.
What the library lacks for this page is tracked as QTRX-13 to QTRX-21; each local stand-in names
its ticket in a comment, to swap once `@qeetrix/react` has it.

Users has three tabs: All users, Invitations and Deleted. **Suspended is a filter on All users**
(`?status=suspended`), not a page: it asks `GET /v1/users/suspended` (searched, filtered and paged on
the server) and shows why, how risky, since when and the review, with Reactivate and Review the
suspension (`people-suspended.tsx`). The old `/users/suspended` address redirects there.

- `components/invitations/`: the Invitations tab — who's waiting, how fast people join (with the
  link's 14 days marked), sends over 15 months, outcomes; Resend, Revoke and Invite again;
- `components/deleted/`: the recycle bin — who's purged next and when, how long people are kept
  (the retention rule, read only with `policy.read`); Restore and Delete forever;
- `components/add-people/`: Add people, the one way in from Users and Invitations — invite by
  email (several addresses, each checked against the directory and pending invitations first) or
  create the account now. It joins the organisation you're in.

The rules behind them are pure functions with their own tests: `invitations-model.ts`,
`deleted-model.ts` and `add-people-model.ts`.

## Groups list

Directory › Groups (`/groups`) is rebuilt on `@qeetrix/react`: `modules/groups/components/list/`.
**The table is the tree.** Families fold; up to 50 groups they start open, past that folded, so the
list opens at the top level. Pages hold 25, 50 or 100 rows, and a family that runs past a page
break carries its path onto the next page ("Continued · Engineering › Identity"). A search or a
filter lists the matches flat, each with its path.

- `groups-list-page.tsx`: the header (breadcrumb, actions, the band), the table and its pager, and
  the drawers and dialogs it opens. `../group-drawer.tsx` is New group and Edit group in one
  drawer: the name checked as it's typed (unique in an organisation), "Inside" searched by path,
  members as pills, and the role's reach said plainly. `../group-members-drawer.tsx` is a group's
  members: add several at once (one toast), remove one through the confirm, which says what they
  lose. `../group-templates-drawer.tsx` makes a template's groups inside any group, flagging names
  already taken first (the server makes all or none); `../import-groups-drawer.tsx` reads a CSV (or
  pasted rows), checks every row before anything is sent, then shows what wasn't made and why;
- `groups-band.tsx`: the Users band's parts (`people.css`, loaded with the console's styles): groups
  over 15 months, the share of people in a group, group sizes, and what needs a look (empty groups,
  roles granted to no one, people in no group). Each opens the list, or Users, filtered to it;
- `groups-toolbar.tsx`: search, size, roles granted and the group to look inside, then Expand or
  Collapse all; `groups-table.tsx`: the tree cell, the columns and a row's menu.

The filters live in the address (`?q=&size=&grants=&role=&inside=&look=`), and the rules are pure
functions in `groups-model.ts`. A group's size is the people it covers, its groups' included; the
roles it grants reach only its own members (the server's rule), so a group that grants a role and
has no members grants it to no one. The server lists groups without their roles (QTID-961), so the
page reads each group's roles, all of them up to 100 groups and only the page's past that. The
library's Table has no tree rows yet (QTRX-25): each group's name is its link, beside its fold
button. Users takes `?group=none` (people in no group) from the band's link.

A group's page (`/groups/:id`, `components/page/`) has its facts in the header (members, the roles
it grants, where it sits, when it was made), then ruled sections: where it sits (`group-family.tsx`,
its family as a picture, each group sized by people and opening its page), members, the roles it
grants, the groups inside it, and details. Deleting a group deletes the groups inside it too (their
parent link cascades), with their memberships and role grants; `use-delete-group.ts` says so in the
confirm, from the list or the page. The console's one confirm (`SensitiveActionProvider`) is the
`@qeetrix/react` alert dialog: red intent line for a destructive action, amber otherwise.

## Organisations

Directory › Organisations (`/organizations`) is rebuilt on `@qeetrix/react`:
`modules/organizations/components/list/` and `components/page/`. It lists the organisations you
belong to (every page of `GET /v1/tenants`), joined with your place in each from
`GET /v1/me/organizations`: your roles, when you last opened it, its domain.

- `orgs-list-page.tsx`: the header and its band (`orgs-band.tsx`, the Users band's parts: people
  across the organisations with the largest as bars, two-step against the Users target, your roles,
  and what needs a look), the toolbar (search, your role, plan, and data region when there's more
  than one), and the table (`orgs-table.tsx`). Each row has Switch, which moves the session into it;
  a name opens its page. There is no edit sheet (Settings › General edits the one you're in, and the
  server changes no other), no preview drawer, and no Suspend: the server always refuses it.
- An organisation's page (`/organizations/:id`) is its record, not a second dashboard: its facts in
  the header; Identity (`org-identity.tsx`: its URL and ID, its domain and what verifying it means,
  its data region on a ruler of Qeet ID's regions); History (`org-history.tsx`: the audit events on
  the organisation itself, summed up, by month, then each with who, browser and address, each
  opening its record in Activity); and, for an owner, Delete. Another organisation shows what the
  list knows and Switch.
- Deleting (`use-org-actions.ts`) is the server's: an owner asks, it's deleted 7 days later, and any
  owner can keep it until then (`POST …/deletion/cancel`). The list doesn't carry the due date yet
  (QTID-963), so only the organisation you're in shows it.

The filters live in the address (`?q=&role=&plan=&region=&look=`), and the rules are pure functions
in `orgs-model.ts`. The logo sits in the page title until `PageHeader` has a leading slot (QTRX-48).

## Directories › Connections

Directory › Directories has four tabs: Connections, Sync activity, Sync errors, Mappings. SCIM and
LDAP / AD are connections, not tabs: each opens from its row or Add connection, at
`/directory/connections/scim` and `/directory/connections/ldap` (the old `/auth/connections/scim`
and `/ldap` redirect), and the command palette finds them by their commands. Connections
(`modules/directory/components/connections/`) is rebuilt on `@qeetrix/react`:

- `connections-page.tsx`: the header, its band (`connections-band.tsx`: where the organisation's
  people come from, each connection's health, the last 30 days, what needs a look), the table and
  the offers for a kind not set up; `connections-table.tsx`: the columns and a row's menu.
- A connection's health is the server's (its latest event; past 24 hours, "not checked"), with its
  latest open problem under it. The 30 days are the server's volume (people and groups synced a
  day) with the month's failed events on top.
- `use-connection-actions.ts`: Test, Turn on/off (turning off is confirmed), Delete and Revoke, each
  confirm saying what happens to people. Their calls live in `api/directory.ts`; the SCIM and LDAP
  pages' own copies in the authentication module go when those pages move here.

`?show=failing|draft` narrows the list from the band. The rules are pure functions in
`connections-model.ts`. LDAP doesn't count its people yet (QTID-964); MenuItem has no description
line (QTRX-50).

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
bun run dev                    # Vite dev server on http://localhost:3002
```

Other scripts:

```bash
bun run build            # production build (Vite + Nitro)
bun run typecheck        # tsc --noEmit
bun run test             # vitest
bun run test:coverage    # vitest + coverage thresholds (what CI runs)
bun run test:e2e         # build, then Playwright: session, tenant isolation, CSP, WCAG 2.2 AA
bun run check            # Biome format + lint; warnings fail
bun run lint:boundaries  # layer rules
bun run audit            # known high/critical vulnerabilities
```

The TanStack devtools launcher is hidden by default so it never competes with operator UI —
opt in only when debugging:

```bash
VITE_ENABLE_DEVTOOLS=true bun run dev
```

## Configuration

`VITE_*` values are exposed to the browser (inlined at build time); their schema is
`src/platform/config/env.ts`. `SERVER_URL`, `SESSION_SECRET` and `PUBLIC_API_URL` are read from
the server environment at runtime. In production, `src/platform/config/server-config.ts` checks
them: until they are valid, every request fails and the server log names the problem.

| Variable | Scope | Dev | Prod |
|---|---|---|---|
| `VITE_API_URL` | client (build time) | `http://localhost:4001` | `https://api.id.qeet.in` |
| `SERVER_URL` | server | falls back to `VITE_API_URL` | required (or `VITE_API_URL`) |
| `PUBLIC_API_URL` | server → browser | falls back to `VITE_API_URL` | required unless `VITE_API_URL` was set at build |
| `SESSION_SECRET` | server | development-only fallback | required, random 32+ characters |
| `VITE_APP_TITLE` | client | `Qeet ID Admin` | `Qeet ID Admin` |

## Deployment (Vercel)

Deployed as a **TanStack Start** project on Vercel. It is SSR via Nitro, so the build emits
Vercel's Build Output API (`.vercel/output`) — the dashboard's "Output Directory" field is
ignored, and no framework config is needed. [`vercel.json`](vercel.json) pins the Bun
install/build commands and turns off Vercel's Git deployments for `main`: production is deployed
by [`deploy.yml`](.github/workflows/deploy.yml) (gate → `vercel build`/`deploy --prod` → version
tag), while PR and `develop` previews still come from Vercel's Git integration. Security response
headers come from Nitro route rules (`vite.config.ts`), which the build writes into the Vercel
output.

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
| [`qeet-id-hosted`](https://github.com/qeetgroup/qeet-id-hosted) | Hosted sign-in — `accounts.id.qeet.in` |
| [`qeet-id-website`](https://github.com/qeetgroup/qeet-id-website) | Marketing site — `id.qeet.in` |
| `qeet-id-deploy` | Backend infrastructure + CD (Terraform) |

Part of the [Qeet Group](https://github.com/qeetgroup) suite; built on the shared `@qeetrix/ui` design system.
