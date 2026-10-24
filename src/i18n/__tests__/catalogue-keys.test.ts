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
// `useTranslation("ns")` or `useTranslation(["ns", "common"])`; with no argument, `common`.
const USE_TRANSLATION = /useTranslation\(\s*(?:"([^"]+)"|\[([^\]]*)\])?/g;
// `<Trans ns="errors" …>` reads its key from that namespace.
const TRANS_NS = /<Trans\b[^>]*?\bns="([^"]+)"/g;
// A key built at runtime: `t(\`section.${value}\`)`; its static head names a section.
const DYNAMIC_KEY = new RegExp(
  String.raw`\bt\(\s*\`((?:(?:${NS}):)?[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\.\$\{`,
  "g",
);

// True when `prefix` names a section (an object) in the namespace.
function sectionExists(ns: string, prefix: string): boolean {
  const node = i18n.getResource("en", ns, prefix);
  return node !== undefined && typeof node === "object";
}

// A plural key exists only with its suffixes.
function exists(ns: string, key: string): boolean {
  return [key, `${key}_other`].some((k) =>
    i18n.exists(`${ns}:${k}`, { lng: "en", fallbackLng: false }),
  );
}

// The keys a file uses that the `en` catalogue lacks. A bare key may belong to any namespace the
// file loads (a file can hold several components), and `i18n.t` defaults to `common`.
function missingKeys(source: string): string[] {
  const fileNs = new Set(["common"]);
  for (const [, single, list] of source.matchAll(USE_TRANSLATION)) {
    const named = list ? [...list.matchAll(/"([^"]+)"/g)].map((n) => n[1] ?? "") : [single];
    for (const ns of named) fileNs.add(ns ?? "common");
  }
  for (const [, ns = "common"] of source.matchAll(TRANS_NS)) fileNs.add(ns);
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
  for (const [, prefix = ""] of source.matchAll(DYNAMIC_KEY)) {
    if (prefix.includes(":")) {
      const [ns = "", path = ""] = prefix.split(":");
      if (!sectionExists(ns, path)) missing.add(`${prefix}.\${…}`);
    } else if (![...fileNs].some((ns) => sectionExists(ns, prefix))) {
      missing.add(`[${[...fileNs].join(",")}]:${prefix}.\${…}`);
    }
  }
  return [...missing];
}

describe("translation catalogue", () => {
  it("scans the source", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200);
    expect(namespaces).toContain("errors");
  });

  it("has an English entry for every key the source uses, and a section for every key it builds", () => {
    const problems: Record<string, string[]> = {};
    for (const [path, source] of Object.entries(sources)) {
      const missing = missingKeys(source);
      if (missing.length) problems[path] = missing;
    }
    expect(problems).toEqual({});
  });
});
