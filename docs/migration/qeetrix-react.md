# Migrating the console to `@qeetrix/react`

**Phase 0a: audit and plan.** Status: for review (2026-10-26). Next: Phase 0b, the design
blueprint (§5).

The console moves from `@qeetrix/ui` 2.1.6 to `@qeetrix/react` (0.1.x) and `@qeetrix/tokens` (0.0.9),
in eight phases, each reviewed before the next starts.

**Screens are rebuilt to the new design, not ported.** Anything the console needs that
`@qeetrix/react` lacks is built in the library first, never in the console:

```text
gap found → mock-up approved → Qeetrix agent builds it in qeetrix-react → PR → release gate approved
         → new version on npm → the console upgrades and uses it
```

---

## 1. What the console is today

| | |
|:--|:--|
| **Framework** | TanStack Start (Vite), Router, Query, Form; Zod; i18next |
| **UI** | `@qeetrix/ui` 2.1.6 and `@qeetrix/icons` 1.0.12, plus Tailwind v4 and the console's own colour variables in `src/styles.css` |
| **Size** | 18 modules, **105 route files**, 470 component files |
| **Styling** | Tailwind-heavy: **5,545 `className` attributes** in 332 files. Only 68 distinct `@qeetrix/ui` components are imported, and only 8 raw form elements, so most layout is Tailwind `div`s |
| **Other UI libraries** | sonner (toasts, 39 files), recharts (charts, 5), @xyflow/react (graphs, 5), monaco (code editor), tiptap (rich text), @thesvg/react (third-party logos, 4) |
| **Languages** | 8: en, hi, de, es, fr, ja, pt, zh |
| **Quality gates** | `ci.yml` on every push to `develop` and `main`: typecheck, Biome, the layering gate (`lint:boundaries`), 203 unit test files with coverage thresholds, 4 Playwright suites (including axe at WCAG 2.2 AA), bundle budgets (signed-in shell 586.4 kB gzip) |

### Screens by module

| Module | Routes | | Module | Routes |
|:--|--:|:--|:--|--:|
| Authentication: admin screens | 16 | | Organisations | 7 |
| Authentication: public pages (sign-in, sign-up…) | 9 | | Dashboard | 6 |
| Authorization | 15 | | Users | 6 |
| Security | 12 | | Directory | 6 |
| Developer | 12 | | Account (public self-service) | 5 |
| Compliance | 4 | | Groups | 2 |
| Activity, Timeline, Billing, Branding, QeetAI | 1 each | | **Total** | **105** |

---

## 2. Component mapping

### `@qeetrix/ui` → `@qeetrix/react`

| `@qeetrix/ui` (imports) | `@qeetrix/react` | Notes |
|:--|:--|:--|
| `Button` (62) | `Button` | Trailing icon; `solid`, `soft`, `ghost`; `brand`, `neutral`, `danger` |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` (24 each) | `Card` | One component: `title`, `level`, `description`, `actions`, `footer`, `variant`, `tone` |
| `Skeleton` (28) | `Skeleton` | `lines`, `size`, `variant="circle"` |
| `Badge` (19), `StatusPill` | `Badge` | Six tones, `subtle` or `solid`, `md` or `sm` |
| `EmptyState` (13), `DataState` | `EmptyState`, `DataState` · experimental | |
| `Input` (9), `Textarea`, `Field`, `FieldLabel`, `FieldDescription`, `FieldError` | `TextField`, `Field`, `Input`, `Textarea` | Label, help and error become props |
| `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | `Tooltip`, `TooltipProvider` | |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` | `Select` | Items as data |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `Tabs`, `TabsList`, `Tab`, `TabsPanel` | `variant="contained"`, `badge` |
| `Table`, `TableHead` (+ `shared/data-table`) | `Table` | One data-driven table: sort, selection, bulk actions, row links |
| `Dialog` and its parts | `Dialog` | `intent="danger"` for confirmations |
| `Sheet` and its parts | `Drawer` | |
| `SegmentedControl`, `SegmentedControlItem` | `ToggleGroup`, `Toggle` | |
| `Switch`, `Separator`, `ScrollArea`, `Progress`, `Spinner` | Same names | |
| `Avatar`, `AvatarImage`, `AvatarFallback` | `Avatar` | One component; `shape="square"` for organisations |
| `Alert`, `AlertTitle`, `AlertDescription` | `Alert` · experimental | |
| `PasswordInput`, `OTPInput`, `Combobox`, `DateRangePicker`, `CodeBlock` | Same · experimental | |
| `SidebarProvider`, `SidebarTrigger` | `AppShell`, `Sidebar` · experimental | Phase 2 |
| `ThemeProvider` | `QeetrixProvider` | Colour scheme, locale, direction, strings |
| **`TimeSince` (14)** | **Gap** | See §3 |
| **`Sparkline` (3)** | **Gap** | See §3 |
| **`Kbd`, `Highlight`** | **Gap** | See §3 |

### The console's own shared parts

| Console part | Becomes |
|:--|:--|
| `shared/components/data-table/*` (toolbar, sort header, selection, bulk bar) | `Table` (`toolbar`, `selectable`, `bulkActions`, sorting) and `SearchField`, `FilterTags` |
| `shared/components/confirm-dialog` | `Dialog intent="danger"` |
| `platform/components/page-header` | `PageHeader` · experimental |
| `platform/components/status-pill` | `Badge` |
| `platform/components/data-state`, `shared/components/page-state` | `DataState`, `EmptyState` |
| `platform/components/theme-toggle` | `useColorScheme()` |
| `shared/components/one-time-secret` | `Alert` + `PasswordInput` + `CopyButton` |
| `shared/components/logo-field` (415 lines), `unsaved-changes-guard`, `error-reference`, `qeet-mark` | Stay console code, rebuilt on library parts (`FileUpload`, `Dialog`, `Text`, `QeetLogo`) |

### Other UI libraries

| Library | Plan |
|:--|:--|
| sonner (39 files) | **Replace** with `ToastProvider` and `useToast` |
| recharts (5) | **Decision needed** (§7): keep it, themed with the `--qx-color-dataviz-*` tokens, or build Qeetrix charts |
| @xyflow/react (5), monaco, tiptap | **Keep**: specialist editors. Theme them with tokens |
| @thesvg/react (4) | **Keep**: third-party brand logos (Google, GitHub…) can't ship in `@qeetrix/icons`, which only carries Qeet's own artwork |

---

## 3. Gaps: library work for the Qeetrix agent

Each needs a mock-up you approve before it's built.

| Need | Used in | Proposal |
|:--|:--|:--|
| **`RelativeTime`** (was `TimeSince`) | 14 places: organisations, sessions, activity | Shows "2 minutes ago" and ticks over live, with the full date on hover. Server-safe first render. Uses `formatRelativeTime` and `formatDateTime` |
| **`Sparkline`** | KPI strips: dashboard, users, activity | Promote `Stat`'s trend line to its own component, so there's one line implementation, not two |
| **`Kbd`** | Universal search | A key cap for shortcut hints. `TopBarSearch`'s shortcut uses it too |
| **`Highlight`** | Search results | Marks the matched text in a result, not by colour alone, without shifting the layout |
| **Library strings in 6 more languages** | Every screen | **Decision needed** (§7): `@qeetrix/react` ships English and Hindi only |

More gaps will turn up as screens are rebuilt. Each follows the same flow.

---

## 4. Running both libraries during the migration

Screens move one module at a time, so for a while both libraries load together. The check:

| | Finding | Handling |
|:--|:--|:--|
| `--qx-*` variables | 53 names are in both; **21 have different values** (mostly the contrast fixes in tokens 0.0.8) | Load `@qeetrix/tokens` after `@qeetrix/ui`, so old screens also get the fixed values |
| Dark mode | `@qeetrix/ui` uses a `.dark` class; `@qeetrix/tokens` uses `data-qx-color-scheme` | One theme switch sets both until the cut-over |
| Density | Both use `data-qx-density` | Nothing to do |

**Phase 1 proves this on a real screen** before any other phase depends on it.

---

## 5. Design direction: one enterprise contract for every screen

Today every screen is styled on its own, and the console reads as over-designed:

| Signal in the code | Uses | Files |
|:--|--:|--:|
| Hand-set spacing (`p-4`, `gap-6`…) | 2,535 | 296 |
| Hand-set text sizes, including fixed pixels | 1,548 | 267 |
| Raw palette colours (`red-500`, `violet-…`) | 386 | 60 |
| Raw colour values (hex, oklch, rgb) | 213 | 13 |
| Cards (often nested, used for everything) | 228 | 101 |
| KPI or metric strips | — | 44 |
| Hover effects and animations | 116 | 87 |
| Large rounding, gradients, blur, heavy shadows | 163 / 23 / 8 / 12 | — |

**Phase 0b (the design blueprint) fixes this before any screen is built.** Its mock-ups are approved by
you and then followed by every phase:

1. **Principles:**
   - calm, data-first and consistent;
   - one main action per page;
   - colour only for status and the primary action: no gradients, blur or decorative motion;
   - numbers only where someone acts on them (KPI tiles on the overview, not on every page);
   - spacing and type from tokens, never hand-set.
2. **Navigation:** the 18 modules grouped into about six sections (for example Overview, Directory,
   Access, Security, Developers, Settings).
3. **Eight page templates.** Every one of the 105 screens maps to one of them (Appendix A):

   | Template | Layout | Example screens |
   |:--|:--|:--|
   | Overview | Key metrics (at most 4), recent activity, next steps | Dashboard |
   | List | Header with one action, search and filters, table, pagination | Users, Groups, API keys |
   | Detail | Back link, title with status, tabs, sections | User, Organisation, Webhook |
   | Settings | Sections of forms, each with its own save | Password policy, Branding |
   | Create or edit | A drawer for quick edits, a full page for complex setup | Invite user, New connection |
   | Empty / first run | One explanation and one action | A module with no data yet |
   | Public page | A centred card at comfortable density | Sign-in, Sign-up |
   | Workspace | A full-width canvas with a toolbar and an inspector panel; no page-level cards | Policy builder, Simulator, Email templates |
4. **Component rules:**
   - when a card is right, and when it isn't;
   - one status-to-colour mapping;
   - dates as relative time with the full date on hover;
   - standard tables, dialogs, toasts and form widths.

**0b deliverable** (ready for review): a clickable prototype of the eight templates, the navigation, the
rules and the four proposed components, built with the real `@qeetrix/react` components, and the
screen-to-template map in Appendix A.

| Template | Screens |
|:--|--:|
| List | 39 |
| Settings | 28 |
| Overview | 9 |
| Public page | 9 |
| Detail | 7 |
| Workspace | 7 |
| Create or edit | 5 |
| Empty / not found | 1 |

**Two findings from the map:**
- **Workspace is the eighth template.** Seven screens are editors, not pages, and fit neither List nor
  Settings.
- **Nine screens are overviews.** Besides the dashboard, Security, Authorization, Developer and others
  have landing pages of their own. The rule "metric tiles on the Overview only, at most four" applies to
  each; Phases 4–6 decide, module by module, whether a landing page earns its place or its module opens
  on its main list.

## 6. The phases

| Phase | Covers | Screens |
|:--|:--|--:|
| **0a · Audit and plan** | This document | — |
| **0b · Design blueprint** | Principles, navigation, the eight page templates as a clickable prototype, screen-to-template map (§5, Appendix A) | — |
| **1 · Foundation** | Install; providers (`QeetrixProvider`, `ToastProvider`, `TooltipProvider`); connect i18next to the library's strings; the theme bridge; one pilot screen | 1 |
| **2 · App frame** | `AppShell`, `TopBar` (organisation and environment switchers, search), `Sidebar` for all modules, the `PageHeader` pattern, error, 404, loading and empty states | frame |
| **3 · Shared patterns and gaps** | Data table, detail page and settings page patterns; forms on `Form` and `ErrorSummary`; toasts off sonner; the §3 components once released | patterns |
| **4 · Core identity** | Dashboard 6, Users 6, Directory 6, Groups 2, Organisations 7 | 27 |
| **5 · Security and access** | Authentication admin 16, Authorization 15, Security 12, Compliance 4 | 47 |
| **6 · Public pages, developer and the rest** | Sign-in, sign-up and other public pages 9, Account 5, Developer 12, Activity, Timeline, Billing, Branding, QeetAI 5 | 31 |
| **7 · Hindi, quality and cut-over** | Hindi complete; accessibility and visual pass; bundle budgets; end-to-end; **remove `@qeetrix/ui`** and the old colour variables; review experimental components for promotion to stable | — |

### Every phase ends with a review package
- before and after screenshots of each screen, light and dark;
- what changed in the design and why;
- library work it caused, with versions;
- test, budget and accessibility results;
- what's next.

The next phase starts only after you've reviewed it.

### Rules for every migrated screen
- **Rebuilt, not ported**, to the design language (design B · Ruled) and the Phase 0b blueprint: each
  screen uses one of the eight page templates.
- **No new Tailwind for looks:** layout through `Stack`, `Inline`, `Grid` and `Box`; `className` for placement only.
- **Every string through i18next,** Hindi included; the library's own strings through `QeetrixProvider`.
- **The console's gates stay green:** typecheck, Biome, `lint:boundaries`, unit and e2e tests (axe included) and the route's bundle budget.
- **One module per pull request into the console's `develop`.**

---

## 7. Decisions (agreed 2026-10-26)

| # | Decision | Agreed |
|:--|:--|:--|
| 1 | Library strings in six more languages | The Qeetrix agent adds de, es, fr, ja, pt and zh packs to `@qeetrix/react` |
| 2 | Charts | Keep recharts, themed with the `--qx-color-dataviz-*` tokens; revisit after the migration |
| 3 | Gap components | Approved: `RelativeTime`, `Sparkline`, `Kbd`, `Highlight`. Mock-ups first |
| 4 | Mock-ups for redesigned screens | The Phase 0b templates are the mock-ups. Screens follow them, and you review after each phase |
| 5 | The Qeetrix agent | Pushes library changes straight to `develop` and reports each push; you raise the PR |
| 6 | Tailwind | Removed from the console at the Phase 7 cut-over, once nothing uses it |

---

## Appendix A · Every screen and its template

| Route file | Template |
|:--|:--|
| `account/routes/public/account` | Detail |
| `account/routes/public/account/data` | Settings |
| `account/routes/public/account/profile` | Settings |
| `account/routes/public/account/security` | Settings |
| `account/routes/public/account/sessions` | List |
| `activity/routes/app/activity` | List |
| `authentication/routes/app/auth/api/consent-grants` | List |
| `authentication/routes/app/auth/api/tokens` | List |
| `authentication/routes/app/auth/connections/index` | List |
| `authentication/routes/app/auth/connections/ldap` | Create or edit |
| `authentication/routes/app/auth/connections/oidc/$clientId` | Detail |
| `authentication/routes/app/auth/connections/oidc/index` | List |
| `authentication/routes/app/auth/connections/saml-idp` | Create or edit |
| `authentication/routes/app/auth/connections/saml` | Create or edit |
| `authentication/routes/app/auth/connections/scim` | Create or edit |
| `authentication/routes/app/auth/login-methods/magic-links` | Settings |
| `authentication/routes/app/auth/login-methods/passkeys` | Settings |
| `authentication/routes/app/auth/login-methods/password` | Settings |
| `authentication/routes/app/auth/login-methods/passwordless` | Settings |
| `authentication/routes/app/auth/mfa/sms-email` | Settings |
| `authentication/routes/app/auth/mfa/totp` | Settings |
| `authentication/routes/app/auth/social` | Settings |
| `authentication/routes/public/_auth` | Public page |
| `authentication/routes/public/_auth/forgot-password` | Public page |
| `authentication/routes/public/_auth/invite.accept` | Public page |
| `authentication/routes/public/_auth/magic` | Public page |
| `authentication/routes/public/_auth/sign-in` | Public page |
| `authentication/routes/public/_auth/sign-up` | Public page |
| `authentication/routes/public/_auth/sso.callback` | Public page |
| `authentication/routes/public/select-organization` | Public page |
| `authentication/routes/public/verify-email` | Public page |
| `authorization/routes/app/authorization/abac` | Workspace (tool) |
| `authorization/routes/app/authorization/access-tester` | Workspace (tool) |
| `authorization/routes/app/authorization/audit` | List |
| `authorization/routes/app/authorization/builder` | Workspace (tool) |
| `authorization/routes/app/authorization/explorer` | Workspace (tool) |
| `authorization/routes/app/authorization/index` | Overview |
| `authorization/routes/app/authorization/permissions` | List |
| `authorization/routes/app/authorization/rbac` | List |
| `authorization/routes/app/authorization/rebac` | Workspace (tool) |
| `authorization/routes/app/authorization/resources` | List |
| `authorization/routes/app/authorization/roles` | List |
| `authorization/routes/app/authorization/settings` | Settings |
| `authorization/routes/app/authorization/simulator` | Workspace (tool) |
| `authorization/routes/app/authorization/templates` | List |
| `authorization/routes/app/authorization/versions` | List |
| `billing/routes/app/settings/billing` | Settings |
| `branding/routes/app/settings/branding` | Settings |
| `compliance/routes/app/security/compliance/gdpr` | Settings |
| `compliance/routes/app/security/compliance/iso27001` | Settings |
| `compliance/routes/app/security/compliance/retention` | Settings |
| `compliance/routes/app/security/compliance/soc2` | Settings |
| `dashboard/routes/app/$` | Empty / not found |
| `dashboard/routes/app/analytics` | Overview |
| `dashboard/routes/app/applications` | List |
| `dashboard/routes/app/authentication` | Overview |
| `dashboard/routes/app/index` | Overview |
| `dashboard/routes/app/settings/index` | Overview |
| `developer/routes/app/auth/api/keys` | List |
| `developer/routes/app/auth/api/machine-identities` | List |
| `developer/routes/app/auth/api/secrets` | List |
| `developer/routes/app/auth/api/signing-keys` | List |
| `developer/routes/app/developer/agents` | List |
| `developer/routes/app/developer/auth-hooks` | List |
| `developer/routes/app/developer/bots` | List |
| `developer/routes/app/developer/credentials` | List |
| `developer/routes/app/developer/index` | Overview |
| `developer/routes/app/developer/infrastructure` | Settings |
| `developer/routes/app/developer/webhooks/$id` | Detail |
| `developer/routes/app/developer/webhooks/index` | Overview |
| `directory/routes/app/directory/attribute-mappings` | Settings |
| `directory/routes/app/directory/connections` | List |
| `directory/routes/app/directory/index` | List |
| `directory/routes/app/directory/sync-activity` | List |
| `directory/routes/app/directory/sync-errors` | List |
| `directory/routes/app/users/suspended` | List |
| `groups/routes/app/groups/$groupId` | Detail |
| `groups/routes/app/groups/index` | List |
| `organizations/routes/app/organizations/$orgId` | Detail |
| `organizations/routes/app/organizations/index` | List |
| `organizations/routes/app/organizations/tenants` | List |
| `organizations/routes/app/settings/organization/domains` | Settings |
| `organizations/routes/app/settings/organization/email-templates` | Workspace (tool) |
| `organizations/routes/app/settings/organization/general` | Settings |
| `organizations/routes/app/settings/organization/security-policy` | Settings |
| `qeetai/routes/app/settings/qeet-ai` | Settings |
| `security/routes/app/security/audit-intelligence` | Overview |
| `security/routes/app/security/audit-logs` | List |
| `security/routes/app/security/device-authorizations` | List |
| `security/routes/app/security/index` | Overview |
| `security/routes/app/security/log-streaming` | Settings |
| `security/routes/app/security/rate-limits` | Settings |
| `security/routes/app/security/sessions` | List |
| `security/routes/app/security/threats/anomalies` | List |
| `security/routes/app/security/threats/bots` | List |
| `security/routes/app/security/threats/ip-allowlist` | Settings |
| `security/routes/app/security/threats/rate-limits` | Settings |
| `security/routes/app/security/threats/risk-settings` | Settings |
| `timeline/routes/app/users/$userId_.timeline` | Detail |
| `users/routes/app/invitations` | List |
| `users/routes/app/users/$userId` | Detail |
| `users/routes/app/users/deleted` | List |
| `users/routes/app/users/import` | Create or edit |
| `users/routes/app/users/index` | List |
| `users/routes/app/users/sessions` | List |
