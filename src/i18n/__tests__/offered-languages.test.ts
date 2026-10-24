// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import i18n, { OFFERED_LANGUAGES, SUPPORTED_LANGUAGES } from "../index";

const files = import.meta.glob<Record<string, unknown>>("../locales/*/*.json", {
  eager: true,
  import: "default",
});

function keysOf(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

// Every key per namespace, for one locale.
function catalogue(lng: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [path, json] of Object.entries(files)) {
    const [, locale, file] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/) ?? [];
    if (locale === lng && file) out.set(file, new Set(keysOf(json)));
  }
  return out;
}

describe("offered languages", () => {
  afterEach(() => i18n.changeLanguage("en"));

  it("offers English, and only locales that have translation files", () => {
    expect(OFFERED_LANGUAGES[0]).toBe("en");
    for (const lng of OFFERED_LANGUAGES) expect(SUPPORTED_LANGUAGES).toContain(lng);
  });

  it.each(OFFERED_LANGUAGES.filter((lng) => lng !== "en"))(
    "offers %s only once it translates every English key",
    (lng) => {
      const translated = catalogue(lng);
      const missing = [...catalogue("en")].flatMap(([ns, keys]) =>
        [...keys].filter((k) => !translated.get(ns)?.has(k)).map((k) => `${ns}:${k}`),
      );
      expect(missing).toEqual([]);
    },
  );

  it("shows a saved or detected language that isn't offered in English", async () => {
    const hidden = SUPPORTED_LANGUAGES.find(
      (lng) => !(OFFERED_LANGUAGES as readonly string[]).includes(lng),
    );
    if (!hidden) return;
    await i18n.changeLanguage(hidden);
    expect(i18n.resolvedLanguage).toBe("en");
    expect(i18n.t("actions.save", { ns: "common" })).toBe("Save");
  });
});
