import i18n, {
  type BackendModule,
  type FlatNamespace,
  type ParseKeys,
  type ResourceKey,
  type TOptions,
} from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

// Every locale with translation files. To add one, add `locales/<lng>/<ns>.json` for each `en`
// namespace (the platform's here, a module's in its own folder), then its code here.
export const SUPPORTED_LANGUAGES = ["en", "hi", "fr", "de", "es", "pt", "ja", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * The locales people can choose. One is offered only once it translates every `en` key (a test
 * holds this), so the console never shows a mix of languages; a saved or detected choice outside
 * the list resolves to English.
 */
export const OFFERED_LANGUAGES = ["en"] as const satisfies readonly SupportedLanguage[];
export type OfferedLanguage = (typeof OFFERED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
};

// Types translation keys from the English catalogues: the platform's here, each module's in its
// manifest. A key no catalogue holds fails the typecheck.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
  }
  interface ResourceNamespaceMap {
    common: typeof import("./locales/en/common.json");
    errors: typeof import("./locales/en/errors.json");
  }
}

/**
 * Any key in any catalogue, namespace-qualified ("users:commands.users.title"; a `common` key may drop its
 * prefix). For a key held as data, such as a manifest's label or an error code's copy, which
 * `i18n.t` renders; a component's own keys are typed by its `useTranslation` namespaces.
 */
export type TranslationKey = ParseKeys<["common", ...Exclude<FlatNamespace, "common">[]]>;

type Catalogue = Record<string, ResourceKey>;

// Catalogues live with their owner: the platform's in src/i18n/locales/<lng>/<ns>.json, each
// module's in src/modules/<module>/locales/<lng>/<ns>.json. The server and tests bundle every
// language; the browser bundles English, which every page needs at first paint, and fetches
// another language when it is chosen.
const bundled: Record<string, Catalogue> =
  import.meta.env.SSR || import.meta.env.MODE === "test"
    ? import.meta.glob<Catalogue>(
        ["/src/i18n/locales/*/*.json", "/src/modules/*/locales/*/*.json"],
        {
          eager: true,
          import: "default",
        },
      )
    : import.meta.glob<Catalogue>(
        ["/src/i18n/locales/en/*.json", "/src/modules/*/locales/en/*.json"],
        { eager: true, import: "default" },
      );
const fetchable: Record<string, () => Promise<Catalogue>> = import.meta.env.SSR
  ? {}
  : import.meta.glob<Catalogue>(
      [
        "/src/i18n/locales/*/*.json",
        "/src/modules/*/locales/*/*.json",
        "!/src/i18n/locales/en/*.json",
        "!/src/modules/*/locales/en/*.json",
      ],
      { import: "default" },
    );

/** Returns the language and namespace a catalogue file holds, from its path. */
function catalogueOf(path: string): { lng: string; ns: string } {
  const [lng = "", file = ""] = path.split("/").slice(-2);
  return { lng, ns: file.replace(/\.json$/, "") };
}

const resources: Record<string, Record<string, Catalogue>> = {};
for (const [path, catalogue] of Object.entries(bundled)) {
  const { lng, ns } = catalogueOf(path);
  resources[lng] ??= {};
  resources[lng][ns] = catalogue;
}
/** Every namespace, from the English catalogues, which are complete by definition. */
export const NAMESPACES = Object.keys(resources.en ?? {}).sort();

const loaders = new Map<string, () => Promise<Catalogue>>();
for (const [path, load] of Object.entries(fetchable)) {
  const { lng, ns } = catalogueOf(path);
  loaders.set(`${lng}/${ns}`, load);
}

// Fetches a catalogue that isn't bundled; a namespace with no file for the language is empty, so
// English shows instead.
const lazyCatalogues: BackendModule = {
  type: "backend",
  init() {},
  read(lng, ns, done) {
    const load = loaders.get(`${lng}/${ns}`);
    if (!load) {
      done(null, {});
      return;
    }
    load().then(
      (catalogue) => done(null, catalogue),
      (error: unknown) => done(error instanceof Error ? error : new Error(String(error)), null),
    );
  },
};

/**
 * Returns the last segment of a key missing from every locale in Title Case, so an operator
 * never sees a raw key such as `secrets.rotateSheet.title`.
 */
export function humanizeMissingKey(key: string): string {
  const last = key.split(/[.:]/).pop() ?? key;
  const spaced = last
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * The locale numbers and dates are formatted in: the reader's own when it shares the console's
 * language (en-IN groups 1,23,456), else the console's, so a date never carries another
 * language's month names. A server render uses the console's language.
 */
export function formatLocale(): string {
  const language = i18n.resolvedLanguage ?? "en";
  if (import.meta.env.SSR || typeof navigator === "undefined") return language;
  return navigator.language.split("-")[0] === language ? navigator.language : language;
}

/** True when a catalogue holds `key` (namespace-qualified), which narrows it for `i18n.t`. */
export function isTranslationKey(key: string, options?: TOptions): key is TranslationKey {
  return i18n.exists(key, options);
}

/**
 * Translates a key built from a value only known at runtime, such as an event category the server
 * sends, which no catalogue may hold yet; a missing one reads as words, like any missing key.
 * A key from a known set of values is typed instead: build it from a union, not a string.
 */
export function translateDynamic(key: string, options?: TOptions): string {
  return isTranslationKey(key, options) ? i18n.t(key, options) : humanizeMissingKey(key);
}

i18n
  .use(lazyCatalogues)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources,
    partialBundledLanguages: true, // English is bundled; another language is fetched when chosen
    ns: NAMESPACES,
    fallbackLng: "en",
    supportedLngs: [...OFFERED_LANGUAGES],
    defaultNS: "common",
    interpolation: {
      escapeValue: false, // React already escapes interpolated values
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "qeetid.lang",
      caches: ["localStorage"],
    },
    parseMissingKeyHandler: (key) => humanizeMissingKey(key), // never render a raw dotted key
    // Logs missing keys in dev only; nothing is sent anywhere.
    missingKeyHandler: import.meta.env?.DEV
      ? (lngs, ns, key) => {
          console.warn(`[i18n] missing key "${key}" (ns: ${ns}) for [${lngs.join(", ")}]`);
        }
      : undefined,
    saveMissing: import.meta.env?.DEV,
  });

export default i18n;
