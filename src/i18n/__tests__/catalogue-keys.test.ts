import { describe, expect, it } from "vitest";

import i18n from "../index";

// Every source file, as text. Tests and the generated route tree hold no copy.
const sources = import.meta.glob<string>(
  [
    "/src/**/*.{ts,tsx}",
    "!/src/**/__tests__/**",
    "!/src/**/*.test.{ts,tsx}",
    "!/src/routeTree.gen.ts",
  ],
  { query: "?raw", import: "default", eager: true },
);

const namespaces = Object.keys(i18n.getDataByLanguage("en") ?? {});
const NS = namespaces.map((ns) => ns.replace(/-/g, "\\-")).join("|");
const KEY = String.raw`[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*`;
// A fully qualified, dotted key anywhere, such as a mutation's `successMessage:
// "users:toast.created"`. The dot keeps permission names such as "users:read" out.
const FULL_KEY = new RegExp(
  String.raw`["'\`](${NS}):([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)["'\`]`,
  "g",
);
// A static key passed to `t(…)`, `i18n.t(…)` or `<Trans i18nKey=…>`.
const T_CALL = new RegExp(String.raw`(?:\bt\(|i18nKey=)\s*"((?:(?:${NS}):)?${KEY})"`, "g");
const USE_TRANSLATION = /useTranslation\(\s*(?:"([^"]+)")?/g;

// A plural key exists only with its suffixes.
function exists(ns: string, key: string): boolean {
  return [key, `${key}_other`].some((k) => i18n.exists(k, { ns, lng: "en", fallbackLng: false }));
}

// The keys a file uses that the `en` catalogue lacks. A bare key may belong to any namespace the
// file loads (a file can hold several components), and `i18n.t` defaults to `common`.
function missingKeys(source: string): string[] {
  const fileNs = new Set(["common"]);
  for (const m of source.matchAll(USE_TRANSLATION)) fileNs.add(m[1] ?? "common");
  const missing = new Set<string>();
  for (const [, ns = "", path = ""] of source.matchAll(FULL_KEY)) {
    if (!exists(ns, path)) missing.add(`${ns}:${path}`);
  }
  for (const [, key = ""] of source.matchAll(T_CALL)) {
    if (key.includes(":")) {
      const [ns = "", path = ""] = key.split(":");
      if (!exists(ns, path)) missing.add(key);
    } else if (![...fileNs].some((ns) => exists(ns, key))) {
      missing.add(`[${[...fileNs].join(",")}]:${key}`);
    }
  }
  return [...missing];
}

describe("translation catalogue", () => {
  it("scans the source", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200);
    expect(namespaces).toContain("errors");
  });

  it("has an English entry for every static key the source uses", () => {
    const problems: Record<string, string[]> = {};
    for (const [path, source] of Object.entries(sources)) {
      const missing = missingKeys(source);
      if (missing.length) problems[path] = missing;
    }
    expect(problems).toEqual({});
  });
});
