# Console redesign: findings from the page mock-ups

**What this is.** In October 2026, 14 agents mocked up every remaining console page on
`@qeetrix/react` (before | after, light, dark and phone), against the real qeet-id-server with seeded
data. This file collects what they found: the decisions to make, the overlaps, bugs, library and
server gaps, and ideas. It is the reference for implementing the pages **one at a time** (see
[qeetrix-react.md](qeetrix-react.md) for the plan and the eight templates).

**Where the mock-ups are:** `/Users/a3097640/Desktop/QG/qeet-id/console-redesign-mockups/`
(outside every repo). Open `index.html` there for every sheet. Each module folder has
`compare-<page>.png` (before | after), dark and phone views, `before/` and `after/` shots, the
harness source (`harness/`) and captured API data (`data/`). `BRIEF.md` is the brief the agents
followed.

**Status:** mock-ups done, **awaiting the user's review**. Nothing below is approved until the user
says so. "Recommended" is the mock-up agent's recommendation, not a decision.

**Out of scope on purpose:** the four duplicate pages the user keeps for now: Authentication ›
MFA › TOTP and SMS / email, Sign-in › Passkeys, Security › Sessions. They are removed later.

---

## 1. Do these first (they touch every page)

1. **Scope the legacy table-header rule.** *(Done with the Dashboard, 2026-10-27.)* `src/styles.css` (~line 418) has an unscoped
   `[data-slot="table-head"]` rule from `@qeetrix/ui`. It restyles every `@qeetrix/react` Table
   header (uppercase, tracked, legacy colour, unreadable in dark), and sortable headers escape it,
   so one header row mixes two styles. Scope it to `.console-legacy` like its neighbours.
2. **Phone top bar shows "Scope".** On a phone the console's top bar reads "Qeet ID | Scope | …"
   instead of the organisation's name: `ConsoleTopBar` doesn't pass `messages={{ scope: <name> }}`
   to `TopBar` (confirmed on the real console).
3. **Shared page parts.** The Settings parts in `src/modules/account/components/account-parts.tsx`
   (`Section`, `Item`, `Detail`, `EditingDetail`, `OpenDetail`, `Panel`, `Failure`, `Loading`,
   `LoadFailed`) and their CSS are what every module's Settings and Detail pages use. Move them
   to shared console code (e.g. `src/platform/components/`) so modules don't copy them.
   One alignment fix proposed with it: a ghost action in a section's head should line up with the
   Edit actions under it.
4. **Event labels.** The audit/activity label catalogue lacks words for `auth.sign_in_failed`,
   `auth.token_reuse_detected`, `role.assigned` and others (Activity needs about 7 more, e.g.
   "Refresh token reused"). Today raw titles show ("Auth Sign_in_failed").
5. **One event drawer.** Activity (Overview › Activity), Security › Audit logs and Authorization ›
   Audit show the same events. Build one list and one event drawer (title, badges, one fact list,
   related events, the raw JSON) used by all three, with a preset filter each.
6. **Tabs in `PageHeader`.** Pass the `TabsList` itself to `PageHeader`'s `tabs`, and let the
   `Tabs` root wrap the whole page; wrapping the list in its own `Tabs` puts the tabs 20px off the
   page gutter.

## 2. Shared conventions the mock-ups agreed

- **Status words** (connections and set-ups): Connected · Needs attention · In setup · Turned off ·
  Not set up; checks say Passed / Failed / Not run. Credentials: Active · Expires soon (within 30
  days) · Expired · Revoked · Disabled · Suspended · Next · Valid.
- **Severity:** Low neutral · Medium warning · High danger · Critical solid danger, always with the
  word. Policy effects are the words "Allow" / "Deny", not coloured badges.
- **Two-step coverage** everywhere comes from `/v1/users/stats` ("18 of 45 people, 40%"), not the
  analytics overview's 38.6%, so Dashboard, Authentication and Users agree.
- **Bot protection** is detection only: say "Detection only · N would block", never "blocked"
  (the server's `blocked_24h` counts would-blocks).
- **Webhook off:** "Turned off" (danger) when failures stopped it, "Disabled" (neutral) when an
  administrator did.
- **Keys:** API key, Rotate, Revoke, Replace key (create new, then revoke old). Pick one of
  "Create API key" / "New API key" for every place.
- **Dates:** relative with the full date on hover; switch to a plain date after about 30 days
  ("last year" on every row is useless).
- **Secrets:** shown once in the create drawer, which only Done closes; focus on Copy; "Copy the
  key now. You won't see it again."
- **KPI tiles** only on overview pages, at most four, numbers someone acts on.
- **Workspace template** (Authorization tools, Emails): page header with tabs; toolbar (subject at
  the start, actions at the end, primary last); three ruled panes edge to edge (list, canvas with
  output docked under it, inspector); no cards; each pane scrolls; phone stacks to one column.

## 3. Decisions for the user (by module)

Each line: the question, then the options; **(R)** marks the recommended one.

**Dashboard** — `dashboard/`
- **Overview, 2026-10-27:** the user rejected the first "after" (four numbers, attention, activity,
  next steps; every chart moved to Analytics) as **very generic**, and asked for the charts back.
  Second mock-up: `compare-overview.png` (`#page=overview` in the harness, `harness/overview.tsx`):
  - then "all bar charts — use line and other charts", so each measure takes the form its job
    calls for;
  - a pulse band: a sparkline in each tile, two-step coverage as a meter with the 80% target;
  - 14 days of sign-ins (area) against failed sign-ins (line), one axis, crosshair tooltip with each
    day's methods, beside Needs attention;
  - Sign-in and security:
    - the methods as a table, each with its own 14-day sparkline on one shared scale;
    - the last 24 hours as a spike line with the two bursts labelled;
    - a two-step gauge against the target, plus a split bar (have one / none yet);
  - People and apps: weekly active people (area + line), the applications people use (dot plot),
    recent activity;
  - Setup: a checklist (the user asked for more than the first fact sheet): "6 of 12 done" over a
    bar with one segment per item, then the items in three ruled panels; each state has its own
    icon and word, and only items that need something carry an action.
  - **Approved and built (2026-10-27)**, branch `feat/dashboard-overview-qeetrix-react`.
  - With it, the user had the console stop saving the set-up answers on the first dashboard load
    (`useApplyOnboardingProfile`, removed): `PATCH /v1/tenants/{id}` needs a step-up, so a new
    administrator met a "Confirm it's you" they couldn't pass. No server change.
  - **One overview (the user's decision, 2026-10-27).** The area overviews (Applications,
    Authentication, Directory, Authorization, Security, Developer, Settings) are gone: they repeated
    the Dashboard and added a click before the work. Each old URL redirects to its area's main page
    (`/auth/connections/oidc`, `/auth/login-methods/password`, `/users`, `/authorization/roles`,
    `/security/threats/bots` (the sidebar's first page until Threats' landing is decided),
    `/auth/api/keys`, `/settings/organization/general`). What only they showed moved to the
    Dashboard, nothing twice:
    - Needs attention: a directory connection that can't reach its server (an open critical
      connection error), groups with no members, wildcard permissions, allow policies with no
      condition;
    - Setup: a Groups row, LDAP "Failing" when its check fails, departments in Your team;
    - a new Organisation row before Setup: departments and their teams (treemap, each opens Users
      filtered to it) and where people work (circles by city, a row per country).
    The groups tree goes to the Groups page. Mock-up: `directory/dashboard-row/`; branch
    `feat/dashboard-only-overview`.
- Applications landing: **(R)** `/applications` is the one Applications list, `/auth/connections/oidc`
  redirects to it, the sidebar loses Applications › Overview · or keep a separate landing page.
- Settings overview: **(R)** drop it, Settings opens on General · or keep the lean list.
  *Decided 2026-10-27: dropped (one overview).*
- Authentication overview numbers: **(R)** none at the top (shares live in the methods table) · or
  a 3-number row.
- Two-step figure: **(R)** users stats · or analytics.

**Users** — `users/`
- Old timeline URL: **(R)** redirect to `?tab=activity` · keep the route · keep a separate page.
- Primary action: **(R)** one "Add user" drawer (Invite recommended, or Create now) · two buttons ·
  Invite only.
- Saved views: **(R)** drop them, filters live in the URL · three built-in views · personal views.
- Row click: **(R)** opens the person's page, preview drawer goes · keep the drawer.
- Developer tab: **(R)** fold in (IDs on Profile, raw JSON in ⋯) · keep a "Raw record" tab.
- Role on import: **(R)** one role for everyone in the file (needs server) · bulk assign afterwards.

**Directory and Groups** — `directory/`
- Directory landing: **(R)** keep the overview · open Directory on Users. *Decided 2026-10-27: open
  on Users (one overview).*
- Directories tabs: keep 6 · **(R)** 4 (Connections, Sync activity, Sync errors, Mappings); SCIM and
  LDAP from Add connection and a connection's row.
- Group detail: **(R)** one page of ruled sections · tabs.
- Server error text on Sync errors: **(R)** a small "For your directory admin" code line · hide it.

**Organisations** — `organizations/`
- Detail tabs for the current organisation: **(R)** read-only summaries linking out · drop Members,
  Security, Billing.
- An organisation you're not in: **(R)** its record and Switch, no tabs · tabs that say "switch".
- `/organizations/tenants` (a redirect to the list): **(R)** keep the redirect · delete the route.
- Data region in General: **(R)** read-only after creation · keep "Change".
- Created dates: **(R)** date with full date on hover · relative.
- Password rules on Settings › Security: **(R)** drop them, one row linking to Sign-in › Password
  (the server only enforces those) · keep both.

**Sign-in methods** — `auth-methods/`
- OAuth grants vs Tokens (same endpoint): **(R)** grants per person, tokens per application · retire
  Tokens.
- Magic-link switch: **(R)** each tab owns its method's switch · fold Magic links into Passwordless.
- Password rules duplicate: as Organisations above.
- Remembered devices: **(R)** stay on Passwordless · move beside the two-step rule.

**Connections** — `auth-connections/`
- OIDC list route: **(R)** redirect to `/applications` · one component on both routes. Bulk delete
  and Export were dropped; ask before restoring.
- Overlap with Directory › Connections: **(R)** `/auth/connections` is the one list of every
  connection (and gets a nav entry); Directory shows it filtered to SCIM and LDAP with sync columns ·
  drop `/auth/connections` · keep both (not recommended).
- Status words: **(R)** the set in §2 for both modules · the server's (Active / Draft / Disabled).
- Several SAML or LDAP connections: **(R)** one setup page each (`/saml/$id`, `/ldap/$id`) · a list
  with a narrow drawer.
- SAML apps: **(R, this wave)** stay under SSO · an Applications "SAML apps" tab.

**Authorization lists** — `authz-lists/`
- Overview: **(R)** keep the lean overview (findings + changes) · open on Roles. *Decided
  2026-10-27: open on Roles; the findings are in the Dashboard's Needs attention.*
- Roles vs RBAC: **(R)** RBAC is the comparison matrix, Roles is where you change a role, one shared
  drawer · put the matrix on Roles and drop RBAC.
- Permissions vs Resources: **(R)** Resources is the cross-model view · fold into Permissions.
- Versions vs Audit: **(R)** keep numbered versions (compare/restore once the server stores
  snapshots) · drop the tab until then.
- Settings (nothing can be set): **(R)** remove from the nav, facts in Help or the builder · keep the
  read-only page.

**Authorization tools** — `authz-tools/`
- Testing pages: **(R)** one "Testing" page in the simulator design (history replaces Explorer, a
  Permission mode replaces the tester) · keep tester + simulator · keep all three.
- Builder vs ABAC: **(R)** Builder becomes ABAC's "New policy"; drop role/relationship blocks until
  the server stores them · keep a separate composer.
- ReBAC objects list: **(R)** a server endpoint · browser-only "recently opened".

**Security overview and logs** — `security-overview/`
- Audit intelligence: **(R)** a "Flagged" view of the audit log · its own Monitoring tab · only the
  top items on the overview.
- Approved device sign-ins: **(R)** "Sign out this device" once the server can; until then "Show in
  the audit log" · today's Revoke (misleads).
- Title: **(R)** "Device sign-ins" · "Device authorizations".

**Threat protection** — `security-threats/`
- Rate-limits duplicate: **(R)** one page at `/security/rate-limits`, `/security/threats/rate-limits`
  redirects, overview links there · the other way round. (The non-working one shows hard-coded,
  wrong values.)
- Stored-but-not-enforced bot checks (honeypot, CAPTCHA, signature): **(R)** hide until enforced ·
  show with "Not enforced yet".
- Bots list: **(R)** grouped by client and address · one row per decision.
- Threats opens on: **(R)** Anomalies · Bots.

**Compliance** — `compliance/`
- Structure: **(R)** one page with tabs SOC 2 · ISO 27001 · GDPR · Retention (SOC 2 and ISO share one
  view) · 3 tabs (Frameworks) · keep 4 pages.
- `na` status label: **(R)** "No evidence" · "Not determinable".
- GDPR data-export requests (server lists them, no console page): **(R)** later · add to GDPR tab.

**Developer overview and webhooks** — `developer-overview/`
- Overview: **(R)** keep the attention overview · drop it, open on API keys. *Decided 2026-10-27:
  dropped, opens on API keys; its alerts were already the Dashboard's.*
- Infrastructure: **(R)** read-only facts page · hide until the server reports health.
- Off endpoint words: **(R)** Turned off / Disabled (§2) · one word "Off".

**Developer credentials** — `developer-credentials/`
- Machine credentials: **(R)** one "Machine access" item with tabs All · API keys · Machine
  identities · Agents (Developer goes from 11 items to 9) · keep three items · later: retire static
  API keys (server work).
- Bots (no backend): **(R)** hide until automations exist · keep the empty state.
- "Credentials": **(R)** rename "Verifiable credentials", under Developer · move under Directory.

**Activity, Billing, Branding, Qeet AI** — `settings-misc/`
- Activity views: **(R)** three tabs (All, Failed, Critical) + a "Saved views" menu · keep 7 chips.
- Accent colour (saved, never read by `qeet-id-hosted`): **(R)** drop it · keep it, marked unused.
- Email sender and sign-in domain on Branding: **(R)** move to Settings › Emails and Settings ›
  Domains · keep them on Branding.
- Token-reuse event wording: Activity says "Critical", Audit says "Blocked" — pick one.

## 4. Console bugs and copy drift found (fix with the page)

- **Authorization overview** says 100/100: the "Everyone reads the employee handbook" policy stores
  `{}` (not null) as its condition, so the check misses an unconditional allow. ABAC's editor turns
  it into a blank condition. Normalise `{}` (server) or treat it as "Always" (console).
- **Authorization › Audit** says "No authorization events" while 74 exist: it loads the latest 200
  events and filters in the browser. It also has no nav entry and its breadcrumb says "Overview".
- **Security › Bots** page is titled "Threats" and says "blocked"; the server only detects.
- **Security overview** "Bot protection: On · honeypot and CAPTCHA · N blocked" is untrue.
- **`/security/rate-limits`** shows hard-coded, wrong values (token endpoint 50/200 not 5/20;
  signed-in requests do have limits; a token bucket, not "sliding"); duplicates the IP rules card;
  says "coming soon" for controls on the other page; the sidebar marks "Overview" on it.
- **IP allowlist refusals** show raw text keys (`threats.ipAllowlist.refusals.paths.`).
- **Retention** help says "1–3650 days" but the slider and validation stop at 365.
- **ISO 27001 page** says 2022; the server's checks use 2013 numbering.
- **Password length slider** stops at 64; the server allows 128.
- **Webhook create sheet** says "retry up to 10 times"; the server retries 60 times over ~2 days and
  turns an endpoint off after 3 days of failures.
- **Developer "Recent activity"** is always empty (server filter bug, see §6).
- **Device authorizations** show expired codes as "Pending" and offer Revoke on rows that aren't live.
- **Signing keys** show the raw server status "Candidate".
- **Verifiable credentials** expired 10 days ago still look valid; the page needs `secret.read` but
  its nav item is gated on `apikey.read`.
- **Machine identities** client ID is cut to 16 characters and can't be copied.
- **Users list** says "1 roles · 1 groups"; Invitations shows "Expires in 2 days" on a revoked invite.
- **Qeet AI** offers `rotate_signing_keys`, which has no endpoint, so it would fail.
- **Activity summary** always covers 24 hours, even with "All time" (misleading "of 197").
- **Social providers** GitHub, Facebook, X, Discord are "supported", but saving needs an OIDC
  discovery URL they don't publish: they likely can't be set up (untested).
- **The console calls `/v1/sso/discovery`**, which the server doesn't have.
- **Nav spelling:** "Organizations" in the sidebar (the console uses British English elsewhere).

## 5. Library gaps (`@qeetrix/react`), for the Qeetrix agent

Asked for by several modules (most-requested first):
- **Small charts** (the Dashboard composes them in the console for now, in
  `dashboard/components/overview/overview-parts.tsx`): `Sparkline` (a line, a 10% wash, a ringed
  end dot; a shared scale across a set), `Gauge` (a semicircle against a target, square ends),
  `DotPlot` (ranked amounts) and `SplitBar` (parts of one whole with a 2px gap).
- **Part-of-whole charts (QTRX-24):** a nested treemap and proportional circles, drawn in the
  console for the Dashboard's Organisation row (`overview-organisation.tsx`, `squarify()` in
  `overview-directory-model.ts`).
- **Chart palette (tokens):** the `--qx-color-dataviz-categorical-*` slots fail the dataviz
  validator.
  - In dark mode 7 of 8 sit above the lightness band (L 0.67); only slot 1 passes.
  - In light mode slot 3 (teal) is under the chroma floor and reads grey.
  - So no multi-colour chart passes in both themes. The second Dashboard mock-up uses slot 1, a
    graphite mix and the status tokens only.
  - Re-step the dark slots into L 0.48–0.67 and raise slot 3's chroma, then run
    `validate_palette.js` light and dark.
- **`RelativeTime`** (already approved): relative with the full date on hover; a date after ~30 days.
- **`Table` on narrow screens:** column priority or stacked rows; scroll the grid, not the page;
  a wrapping bulk bar.
- **`Table` details:** sortable headers lose the header style (button `text-transform`); a "current
  row" mark while a drawer or detail shows it; per-row `selectable`; `rowActions` hidden per row;
  tree rows (depth, expand) for nested groups; grouped rows; clickable or sticky headers for a
  matrix.
- **`Stat`** with `href`; **`StatGroup`** two-up on phones.
- **`Pagination`** for cursor paging (the audit log, organisations).
- **`PageHeader`:** a leading slot (avatar, logo); document that `tabs` takes a `TabsList`.
- **`Steps`:** a per-step "attention"/"failed" state, and keeping later steps done when an earlier
  one needs work.
- **A checks-result list** (Passed / Failed / Not run with words) for SAML, LDAP and directory checks.
- **`CopyField`** (read-only value + Copy), used six times on credential pages.
- **`Field`** with an action in its label row ("Insert variable").
- **`Toolbar`** (Base UI has one) for editors; **Workspace layout parts** (panes, toolbar, docked
  output) for Authorization tools and Emails.
- **Editable code field** (CodeBlock is read-only).
- **Badge slot** in `MenuItem` and tile `Radio` ("Recommended").
- **Colour field** (swatch + hex + picker); **free-text combobox** ("suggested model or your own").
- **Live tables:** a "new rows" band.
- **Charts:** Qeetrix tooltip and legend for recharts; **dataviz palette**: light categorical-3 is
  below the chroma floor, categorical-4 and -5 are too close (ΔE 14.7 < 15), dark categorical
  colours fall outside the lightness band.
- **Graph / node canvas** (layered layout, zoom and fit, keyboard) for ReBAC.
- `FileUpload`'s automatic hint reads "SVG+XML, up to 2.1 MB".

Console-side parts (not library): the policy rule canvas; `PlanCards` gets an optional `current`
prop for Billing ("Current plan").

## 6. Server gaps (for QTID tickets — only those the user picks)

**Cross-cutting**
- Summary endpoints: a "needs attention" list for the Dashboard (today ~8 calls) and a security
  summary for the Security overview (~8 calls).
- Audit list: return `metadata`; actor name and email; resource name and target label; from/to time
  and `resource_id` filters; several resource types or an "authorization" category; a total; fetch
  one event by ID; record when the chain was last verified.
- Activity: a "notable events" filter; `?category=developer` filters after the limit (empty page with
  a `next_cursor`); the summary ignores the chosen range; events have no location.

**Users and directory**
- `GET /v1/users`: search, filters, sort and total, and the Users list counts in `/v1/users/stats` — **QTID-960**. Until then the rebuilt list reads up to 2,000 people and works over them in the browser.
- `POST /v1/users/bulk`: `role_id` and metadata; a role for an import.
- Per-user risk endpoint; per-user sign-in method summary; which role or group grants each permission.
- Admin ending one member session (only revoke-all exists); member passkeys list and removal;
  session country.
- Suspension reason and date on the user record; who suspended.
- Invitations: return `invited_by`; add `revoked_at`.
- `/users/stats`: `invited: 0` while 2 are pending; anomaly `affected_accounts: 0` while 7 were hit.
- Users `source` (Qeet ID, SCIM, LDAP); count of people in no group.
- Groups: `GET /v1/groups/{id}`; source / managed-by; roles in the list; member status, title and
  date added; `member_count` disagrees with members (6 vs 5).
- Sync errors: a cause code (DNS, refused, timeout, TLS, bind); open errors not cut off by `days`; a
  grouped "problems" view; affected person per event.
- LDAP: health, last sync and user count (always null); the test returns only `{ok}`; a "people
  found under base DN" check; a dry-run sign-in (`/ldap/{id}/authenticate` signs in for real).
- Mappings: return the effective mapping, including the connection's own `mail`/`cn`.

**Organisations**
- Member count 46 vs 45 users (a deleted account counted?); MFA share 39% vs 38.6%.
- `PATCH /v1/tenants` can't change `metadata` (headquarters, industry, website).
- `/v1/tenants` is cursor-paged; per-organisation details locked to the active one.
- Branding logo is a `data:` URL, which emails reject, so "Show logo" has no effect.
- The policy saves as one whole-object `PUT` (doesn't suit per-row saves with step-up).
- The default hosted sign-in address isn't in any API.
- `/policy` stores `password_min_length` / `password_complexity` but they aren't enforced (two
  sources of truth with auth-policy).

**Sign-in and connections**
- Per-provider social sign-in and linked-account counts; counts of people with a passkey or a
  password (to warn before turning password off).
- Grants: application and person names, last used, the consent date (`issued_at` is the latest
  renewal); list stored consents; revoke all for an app or several at once.
- SAML: import metadata from a URL (server-side, SSRF-safe); certificate expiry, subject and
  fingerprint, with a warning before it lapses; store preflight results; domain → connection routing
  (`/v1/sso/discovery` missing); per-app access and sign-in counts.
- SCIM: groups provisioned; last request status or error.
- OIDC: back- and front-channel logout URIs are returned but dropped by the console schema; last
  sign-in per app; people signed in only derivable from grants.

**Authorization**
- Role people, group and permission counts; role → groups lookup; rename/delete a role; set a role's
  permissions in one call.
- Policy version snapshots and revert; an authorization-settings API; decision metrics.
- Dry-run an unsaved policy (`/abac/evaluate` checks stored ones only); store policies that mix
  roles or relationships with ABAC; batch evaluation; an attribute catalogue.
- ReBAC: list objects and types; names for `user:<uuid>` in graph and tuples; a server-side decision
  log (Explorer covers one browser session today).

**Security**
- IP rules: `POST /ip-rules/check` answers "allowed, enforcement off" whenever enforcement is off (so
  "check before turning on" can't work) — needs a "would be refused" result; who and when changed
  enforcement.
- Bots: paging, filters, grouping (capped at 50); which account was targeted and the outcome.
- Anomalies: paging and total (limit 50); `resolved_by`.
- Rate limits: say defaults vs overrides and the ceiling; expose built-in limits.
- Risk: signal weights; whether a country header is configured (without it, impossible travel never
  fires).
- Log sinks: a test endpoint; PATCH beyond on/off (fixing an endpoint means remove and re-add, with no
  backfill); failure start time and queued count.
- Devices: client name; `consumed_at`; signing out the tokens a grant issued.

**Compliance**
- Owner per control; per-control "failing since" (today: fetch every run); control `detail` is English
  developer text (needs a code + parameters + a remedy field); the ISO catalogue uses 2013 numbering;
  CC6.5 is filed under "Change Management"; a way to record an external audit or certificate;
  erasure requests carry only `user_id` (`GET /users/{id}` 404s for deleted people); a `quarantined`
  erasure status the console type lacks; person search including deleted people; the 30-day grace
  period isn't in any response; retention GET returns only `enabled` and `days` (no due-now / next due,
  no last changed by).

**Developer**
- Webhooks: last delivery and held/retrying/gave-up counts per endpoint; deliveries paging, status
  filter and bulk retry; `PATCH /webhooks/{id}` (URL and events can't change).
- Auth hooks: last call and skip count; PATCH beyond `enabled` and `fail_open`.
- API keys: a rotate endpoint; `created_by` on organisation keys.
- Machine identities: `last_used_at`; secret rotation; `description` accepted but not returned.
- Agents: `last_used_at`; the decommission endpoint exists but the console doesn't use it.
- Secrets: last revealed; a rotation policy.
- Signing keys: return `activated_at`, `retire_at`, `created_at`; a rotation route.
- Verifiable credentials: the subject is a DID only (no person's name).
- A tenant-facing health endpoint.

**Billing**
- A payment-method endpoint (brand, last 4, expiry, manage link).
- Invoices: GST invoice number, supplier GSTIN, SAC code, per-component tax lines, a PDF (CGST/SGST
  are shown as equal halves today).
- Usage reports 48 seats vs 46 members; the token-reuse event names a user but has actor "system".

## 7. Ideas and new features the research surfaced (not requested — ask first)

- **GDPR data-export requests** page or section (the server lists them already).
- **Vendor import UI** for `/v1/users/bulk/import?source=auth0|cognito|azure_b2c` (exists, no UI).
- **Agents decommission** (endpoint exists, unused).
- **"Needs attention" everywhere:** a shared attention list (Dashboard, Directory, Security,
  Developer, Authorization overviews) backed by one summary endpoint.
- **Shareable filtered views:** filters in the URL instead of saved views.
- **Machine access** as one place for every non-human credential; later, retire static API keys in
  favour of machine identities.
- **SAML apps in Applications**, so every app that signs in with Qeet ID is in one place.
- **Certificate and key expiry warnings** (SAML certificates, signing keys, API keys) on the
  Dashboard's attention list.
- **Compliance evidence** that can record an external audit or certificate (today: readiness only).
- **Per-person risk** on the user page, from a server endpoint rather than the tenant anomaly list.

## 8. Data notes for whoever shoots screenshots

- The seeded **Qeet Group** has 45 people (not ~290), 21 groups, one LDAP draft, no SCIM.
- Automated sign-ins as `priya@qeet.in` inflate "sign-ins today" and fill the first audit page; they
  also switch organisation, which sends `session.revoked` to two seeded webhooks whose hosts don't
  resolve, so the server turns those webhooks off (28–29 Oct 2026). `make seed-reset` restores it.
- The "before" console for mock-ups ran on `:43400` against `:4001`; `sign-in.mjs` in the mock-ups
  folder signs in through Mailpit (`:8025`).
