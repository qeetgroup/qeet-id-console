import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";

import { MODULES } from "@/app/modules";
import { NAMESPACES } from "@/i18n";
import { getNavGroups } from "@/platform/config/navigation";
import { shortcutGroups } from "@/platform/keyboard/shortcuts";
import type { ModuleManifest } from "@/platform/modules/manifest";
import {
  commandContributions,
  navContributions,
  registeredModules,
  registerModules,
  shortcutContributions,
} from "@/platform/modules/registry";
import { routeTree } from "@/routeTree.gen";

const moduleFolders = new Set(
  Object.keys(import.meta.glob("/src/modules/*/index.ts")).map((p) => p.split("/")[3]),
);
const catalogueFiles = Object.keys(import.meta.glob("/src/modules/*/locales/en/*.json"));
const manifestSources = import.meta.glob<string>("/src/modules/*/manifest.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Every route's full path, from a router built on the generated tree.
function routePaths(): Set<string> {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return new Set(Object.keys(router.routesByPath).map((p) => p.replace(/(.)\/$/, "$1")));
}

const duplicates = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);

describe("module registry", () => {
  const registered = registeredModules();
  afterEach(() => registerModules(registered));

  it("registers every module folder, in src/app/modules.ts order", () => {
    expect(new Set(MODULES)).toEqual(moduleFolders);
    expect(registered.map((m) => m.id)).toEqual([...MODULES]);
  });

  // A manifest types its keys from each catalogue in its locales folder, under the file's name.
  it("declares exactly the namespaces in each module's locales folder", () => {
    for (const m of registered) {
      const owned = catalogueFiles
        .filter((p) => p.startsWith(`/src/modules/${m.id}/`))
        .map((p) => (p.split("/").at(-1) ?? "").replace(/\.json$/, ""))
        .sort();
      const source = manifestSources[`/src/modules/${m.id}/manifest.tsx`] ?? "";
      const declared = [
        ...source.matchAll(/"?([\w-]+)"?: typeof import\("\.\/locales\/en\/([\w-]+)\.json"\)/g),
      ].map(([, name, file]) => {
        expect(name, m.id).toBe(file);
        return file ?? "";
      });
      expect(declared.sort(), m.id).toEqual(owned);
      for (const ns of owned) expect(NAMESPACES).toContain(ns);
    }
  });

  it("keeps ids unique and points every entry at a real route", () => {
    expect(duplicates(navContributions().map((e) => e.id))).toEqual([]);
    expect(duplicates(commandContributions().map((c) => c.id))).toEqual([]);
    expect(duplicates(shortcutContributions().map((s) => s.key))).toEqual([]);
    for (const s of shortcutContributions()) expect(s.key).toMatch(/^[a-z]$/);

    const paths = routePaths();
    const targets = [
      ...navContributions().map((e) => e.url),
      ...commandContributions().map((c) => c.to),
      ...shortcutContributions().map((s) => s.to),
    ];
    expect(targets.filter((to) => !paths.has(to))).toEqual([]);
  });

  it("refuses a module registered twice", () => {
    const users = registered.find((m) => m.id === "users") as ModuleManifest;
    expect(() => registerModules([users, users])).toThrow(/registered twice/);
  });

  // The point of manifests: a new module reaches the shell through its manifest alone.
  it("adds a new module's entries, commands and shortcuts with no shared file edited", () => {
    const fixture: ModuleManifest = {
      id: "fixture",
      nav: [
        {
          id: "overview.fixture",
          group: "overview",
          order: Number.MAX_SAFE_INTEGER,
          title: "common:navGroup.overview",
          url: "/fixture",
        },
      ],
      commands: [
        { id: "cmd.navigate.fixture", text: "users:commands.users", icon: null, to: "/fixture" },
      ],
      shortcuts: [{ key: "y", description: "common:navGroup.overview", to: "/fixture" }],
    };
    registerModules([...registered, fixture]);

    const overview = getNavGroups().find((g) => g.id === "overview");
    expect(overview?.items.at(-1)?.url).toBe("/fixture");
    expect(commandContributions().at(-1)?.to).toBe("/fixture");
    expect(shortcutGroups().at(-1)?.items.at(-1)?.path).toBe("/fixture");
  });

  it("refuses a nav entry naming a group or parent that doesn't exist", () => {
    registerModules([
      ...registered,
      {
        id: "broken",
        nav: [
          { id: "x.y", group: "nowhere", order: 1, title: "common:navGroup.overview", url: "/" },
        ],
      },
    ]);
    expect(() => getNavGroups()).toThrow(/unknown group/);
  });
});
