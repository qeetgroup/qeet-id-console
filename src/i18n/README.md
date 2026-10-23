# i18n

Internationalization scaffold built on
[`i18next`](https://www.i18next.com/) + [`react-i18next`](https://react.i18next.com/),
with language detection via `i18next-browser-languagedetector`. It is designed
so that adding a locale later is a drop-in JSON change — no code edits to the
screens that already use `t()`.

## Layout

Every catalogue lives with its owner, one JSON file per namespace and language:

```
src/i18n/
  index.ts                     discovers the catalogues and initializes i18next (default export)
  locales/<lng>/common.json    the platform's: shared actions, states, shell copy
  locales/<lng>/errors.json    the platform's: curated error copy
src/modules/<module>/locales/<lng>/<namespace>.json
                               a module's own copy, usually one namespace named after it
                               (authentication also owns auth-flow, oidc, saml and consent;
                               developer signing-keys; security device; users invitations)
```

A module lists its namespaces in its `manifest.tsx`, and `locale-parity.test.ts` holds that each
namespace has exactly one owner. Adding a module adds its catalogues with no edit here:
`index.ts` finds them by path.

English is the source locale (6,117 keys in 27 namespaces). The other locales are partial; their
key coverage on 2026-10-24: de, es, fr, hi, ja, pt and zh 5% each. A key nothing uses is deleted
from every locale.

Only `OFFERED_LANGUAGES` can be chosen, and today that is English: a locale is offered once it
translates every `en` key, so the console never shows a mix of languages.
`src/i18n/__tests__/offered-languages.test.ts` holds the rule. A saved or detected language that
isn't offered resolves to English; the partial files stay, ready to finish.

Keys within a namespace are grouped by the sub-area of the screen (e.g. `list.*`, `create.*`,
`table.*`) to keep them discoverable.

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

## Typed keys

Keys are typed from the English catalogues, so a key no catalogue holds fails the typecheck. The
platform declares `common` and `errors` in `src/i18n/index.ts`; each module declares its own
namespaces at the foot of its `manifest.tsx` (`declare module "i18next" { interface
ResourceNamespaceMap { … } }`), which a test keeps equal to its `locales/en/` folder.

- A component's `t` takes the keys of the namespaces its `useTranslation` names: the first
  unprefixed, the others with their prefix. Name every namespace a component reads from:
  `useTranslation(["users", "common"])`, then `t("common:actions.cancel")`.
- A helper that receives `t` types it as the caller's: `TFunction<["users", "common"]>`.
- A key held as data (a manifest entry, an options list, a code → key map) is a `TranslationKey`
  (`@/i18n`): namespace-qualified, rendered with `i18n.t`. A map of one namespace's own keys may
  be `Record<Code, ParseKeys<"ns">>` and rendered with that namespace's `t`.
- A key built from a value type-checks when the value is one of a known set: type the set as a
  union or an `as const` array (`isOneOf` from `@/shared/utils/one-of` narrows a string to it).
  A value only the server knows, such as an event category, goes through `translateDynamic`,
  which reads a missing key as words; `isTranslationKey` checks one at runtime.
- Never cast a key. The one deliberate unknown key, in `index.test.ts`, is marked
  `@ts-expect-error`.

Measured on 2026-10-24, key types take the typecheck from 1.7 GB and 12 s to 2.7 GB and 21 s.
A call site that doesn't compile costs far more (TypeScript elaborates the error against every
key), so a tree with many key errors checks slowly until they are fixed.

## Numbers and dates

`formatLocale()` is the locale for every `toLocaleString`, `Intl.NumberFormat` and
`Intl.DateTimeFormat`: the reader's own when it shares the console's language (en-IN, en-GB),
else the console's, so a French browser never sees "16 août" in the English console. A server
render uses the console's language. `Intl.DisplayNames`, `ListFormat` and `Collator` produce
words, so they follow the UI language (`i18n.language`).

## Adding a new locale

1. Add `<lng>/<namespace>.json` beside each `en` one (the platform's here, each module's in its
   folder), translating the values and keeping the keys identical.
2. Add `<lng>` to `SUPPORTED_LANGUAGES` and a label to `LANGUAGE_LABELS` in `src/i18n/index.ts`.
3. Once every `en` key is translated, add `<lng>` to `OFFERED_LANGUAGES`; the offered-languages
   test fails while any is missing.

The header's language switcher and the profile's language field list `OFFERED_LANGUAGES` and
stay hidden while there is only one. The detector persists the choice to `localStorage` under
`qeetid.lang`.

## Loading

`src/i18n/index.ts` runs `i18n.init(...)` at import time, imported at the top of `src/router.tsx`.
English is bundled, so init is synchronous and the server's first render already has it. The
server and the tests bundle every language; the browser fetches any other language only when it
is chosen (a small backend over `import.meta.glob`), and the router's `hydrate` waits for it, so
the first client render shows the same copy as the server's.

## Checks

- `catalogue-keys.test.ts`: every static key the source uses has an `en` entry, and every key it
  builds at runtime (`` t(`severity.${s}`) ``) has its section.
- `locale-parity.test.ts`: each namespace lives in one owner's folder, and no other locale holds
  a key `en` no longer has (plural forms aside, which differ by language).
- `offered-languages.test.ts`: an offered locale translates every `en` key.

## Copy outside components

Every user-facing string is a catalogue key, including copy that isn't written in a component:

- **Toasts:** a mutation's `meta.successMessage` / `successDescription` is a fully qualified key
  (`"users:toast.created"`); the query client (`src/platform/query/query-client.ts`) translates it,
  and falls back to `common:toast.saved`. Its own plan-limit and access-changed toasts live in
  `errors:toast.*`.
- **Errors:** curated error copy for each backend code, the per-kind fallbacks and the field
  messages live in the `errors` namespace (`src/platform/errors/user-message.ts` maps codes to keys).
- **Shell contributions:** a module's sidebar entries, commands, shortcuts and Qeet AI
  suggestions in its `manifest.tsx` hold keys in its own namespace (`<ns>:nav.*`, `<ns>:commands.*`,
  `<ns>:shortcuts.*`, `<ns>:qeetaiSuggestions.*`); the group names are `common:navGroup.*`.
  `useNavGroups()` returns the sidebar translated, and groups compare on their `id`, never their
  label.
- **Qeet AI tool results:** `summary` is English written for the model and is never rendered;
  `display` is a key in `qeetai:toolCallCard.results.*` with its values, which the tool card shows.
- **Tables and models:** option lists, status maps and model helpers hold keys (or value codes
  whose key the component derives) and translate where they render. Non-React code calls
  `i18n.t("<ns>:key")` with `import i18n from "@/i18n"`.

`src/i18n/__tests__/catalogue-keys.test.ts` reads the source and fails when a static key (`t("…")`,
`i18nKey="…"`, or any `"<ns>:dotted.key"` literal) has no `en` entry, or a runtime key's prefix
(`` t(`severity.${value}`) ``) has no section; the typecheck covers the rest (see Typed keys).

## What stays as it is

Brand and product names (Qeet ID, Google, Splunk), protocol and format names (SAML, OIDC, SCIM,
TOTP, CSV, JSON), code identifiers and capability names (`audit.read`), sample values, anything
sent to the backend or to the AI model (tool definitions, prompts), export-file column headers
(a data format, the same in every locale), logs, and error messages that are never rendered.

A fixed set of server values (a reason or status code) is mapped to keys, never rendered as the
server's own words; a server sentence with no mapping isn't shown.
