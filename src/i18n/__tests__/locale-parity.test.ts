import { describe, expect, it } from "vitest";

import i18n, { NAMESPACES, SUPPORTED_LANGUAGES } from "../index";

// Every catalogue file, by path: the platform's and each module's.
const files = Object.keys(
  import.meta.glob(["/src/i18n/locales/*/*.json", "/src/modules/*/locales/*/*.json"]),
);

type Tree = { [key: string]: Tree | string };

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leaves(value, `${prefix}${key}.`),
  );
}

// Plural forms differ by language (Japanese has only `_other`, Hindi adds none), so a key is
// compared without its plural suffix.
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");

describe("translation catalogues", () => {
  it("keeps each namespace in one owner's folder, the same in every language", () => {
    const owners = new Map<string, Set<string>>();
    for (const path of files) {
      const parts = path.split("/");
      const ns = (parts.at(-1) ?? "").replace(/\.json$/, "");
      const owner = parts.slice(0, -2).join("/");
      owners.set(ns, (owners.get(ns) ?? new Set()).add(owner));
    }
    const shared = [...owners].filter(([, set]) => set.size > 1).map(([ns]) => ns);
    expect(shared).toEqual([]);
    expect([...owners.keys()].sort()).toEqual(NAMESPACES);
  });

  it.each(SUPPORTED_LANGUAGES.filter((lng) => lng !== "en"))(
    "translates only keys English has (%s)",
    (lng) => {
      const stale: string[] = [];
      for (const ns of NAMESPACES) {
        const english = new Set(leaves((i18n.getResourceBundle("en", ns) ?? {}) as Tree).map(base));
        const translated = leaves((i18n.getResourceBundle(lng, ns) ?? {}) as Tree);
        stale.push(...translated.filter((key) => !english.has(base(key))).map((k) => `${ns}:${k}`));
      }
      expect(stale).toEqual([]);
    },
  );
});
