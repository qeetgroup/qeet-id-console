# i18n

Internationalization scaffold built on
[`i18next`](https://www.i18next.com/) + [`react-i18next`](https://react.i18next.com/),
with language detection via `i18next-browser-languagedetector`. It is designed
so that adding a locale later is a drop-in JSON change — no code edits to the
screens that already use `t()`.

## Layout

```
src/i18n/
  index.ts            initializes the shared i18next instance (exported default)
  README.md           this file
  locales/
    en/               the source locale: account, auth, auth-flow, common, compliance, consent, dashboard, developer, device, groups, invitations, oidc, organizations, rbac, saml, security, settings, signing-keys, users
    <lng>/            the same namespaces, translated
```

English is the source locale (4476 keys in 19 namespaces). The other locales are
partial; their key coverage on 2026-10-23: de 7%, es 7%, fr 7%, hi 7%, ja 7%, pt 7%, zh 7%.

Only `OFFERED_LANGUAGES` can be chosen, and today that is English: a locale is offered once it
translates every `en` key, so the console never shows a mix of languages.
`src/i18n/__tests__/offered-languages.test.ts` holds the rule. A saved or detected language that
isn't offered resolves to English; the partial files stay, ready to finish.

Each top-level JSON file is an i18next **namespace**. Keys are grouped by the
sub-area of the screen (e.g. `oidc.list.*`, `oidc.create.*`, `users.table.*`)
to keep them discoverable and avoid collisions.

## Using translations in a component

```tsx
import { useTranslation } from "react-i18next";

function MyScreen() {
  const { t } = useTranslation("oidc");          // pick the namespace
  return <h1>{t("list.registeredTitle")}</h1>;   // key is namespace-relative
}
```

- `common` is the default namespace, so `t("actions.save")` works without
  passing a namespace. From any other namespace, reach shared strings with the
  `common:` prefix, e.g. `t("common:actions.cancel")`.
- **Interpolation:** `t("oidc.list.appCount", { count })`. `escapeValue` is off
  because React already escapes, so interpolated values render verbatim.
- **Pluralization:** define `key_one` / `key_other` and call with `{ count }`;
  i18next picks the right form (see `users.list.membersSubtitle`).
- **Rich text:** keys containing tags like `<strong>…</strong>` are rendered
  with the `<Trans>` component (`react-i18next`) so the markup stays in the
  catalog instead of the JSX. Map each tag to a React element via
  `components={{ strong: <span className="…" /> }}`.

## Adding a new locale

1. Create `src/i18n/locales/<lng>/` and copy every namespace JSON from `en`,
   translating the values (keep the keys identical).
2. In `src/i18n/index.ts`:
   - import the new namespace files,
   - add `<lng>` to `SUPPORTED_LANGUAGES`,
   - add a label to `LANGUAGE_LABELS`,
   - register the namespaces under `resources.<lng>`.
3. Once every `en` key is translated, add `<lng>` to `OFFERED_LANGUAGES`; the offered-languages
   test fails while any is missing.

The header's language switcher and the profile's language field list `OFFERED_LANGUAGES` and
stay hidden while there is only one. The detector persists the choice to `localStorage` under
`qeetid.lang`.

## Where it is initialized

`src/i18n/index.ts` runs its `i18n.init(...)` at import time and is imported
once at the top of `src/router.tsx` (the module both the SSR and client
entries call to build the router). Because the `en` resources are bundled
statically, init is synchronous and SSR-safe — there is no async gate before
React mounts.

## Copy outside components

Every user-facing string is a catalogue key, including copy that isn't written in a component:

- **Toasts:** a mutation's `meta.successMessage` / `successDescription` is a fully qualified key
  (`"users:toast.created"`); the query client (`src/platform/query/query-client.ts`) translates it,
  and falls back to `common:toast.saved`. Its own plan-limit and access-changed toasts live in
  `errors:toast.*`.
- **Errors:** curated error copy for each backend code, the per-kind fallbacks and the field
  messages live in the `errors` namespace (`src/platform/errors/user-message.ts` maps codes to keys).
- **Navigation:** the nav tree (`src/platform/config/nav-groups*.tsx`) holds `nav` keys;
  `useNavGroups()` returns it translated, and groups compare on their `id`, never their label.
- **Tables and models:** option lists, status maps and model helpers hold keys (or value codes
  whose key the component derives) and translate where they render. Non-React code calls
  `i18n.t("<ns>:key")` with `import i18n from "@/i18n"`.

`src/i18n/__tests__/catalogue-keys.test.ts` reads the source and fails when a static key (`t("…")`,
`i18nKey="…"`, or any `"<ns>:dotted.key"` literal) has no `en` entry. Keys built at runtime
(`` t(`severity.${value}`) ``) aren't visible to it, so cover those with the module's own tests.

## What stays as it is

Brand and product names (Qeet ID, Google, Splunk), protocol and format names (SAML, OIDC, SCIM,
TOTP, CSV, JSON), code identifiers and capability names (`audit.read`), sample values, anything
sent to the backend or to the AI model (tool definitions, prompts), export-file column headers
(a data format, the same in every locale), logs, and error messages that are never rendered.

A fixed set of server values (a reason or status code) is mapped to keys, never rendered as the
server's own words; a server sentence with no mapping isn't shown.
