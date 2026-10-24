import { describe, expect, it } from "vitest";

import {
  checkBudgets,
  type ManifestRoute,
  measure,
  parseBudgets,
  routeChain,
  staticClosure,
  staticImports,
  suggestBudget,
} from "../check-bundle-size.mjs";

// A small app as TanStack Start's manifest describes it: the root with the entry, the signed-in
// shell (/_app) with two pages, a public page, and a server route with no client code.
const routes: Record<string, ManifestRoute> = {
  __root__: {
    children: ["/_app", "/sign-in", "/healthz"],
    preloads: ["/assets/entry.js"],
    scripts: [{ attrs: { src: "/assets/entry.js" } }],
  },
  "/_app": { children: ["/_app/users", "/_app/orgs"], preloads: ["/assets/app.js"] },
  "/_app/users": { preloads: ["/assets/users.js"] },
  "/_app/orgs": { preloads: ["/assets/orgs.js"] },
  "/sign-in": { preloads: ["/assets/sign-in.js"] },
  "/healthz": {},
};

const imports: Record<string, string[]> = {
  "/assets/entry.js": ["/assets/react.js"],
  "/assets/app.js": ["/assets/react.js", "/assets/ui.js"],
  "/assets/users.js": ["/assets/ui.js", "/assets/table.js"],
  "/assets/orgs.js": ["/assets/ui.js"], // its editor is a dynamic import, so not listed
  "/assets/sign-in.js": ["/assets/ui.js"],
};

const gzip: Record<string, number> = {
  "/assets/entry.js": 50_000,
  "/assets/react.js": 60_000,
  "/assets/app.js": 10_000,
  "/assets/ui.js": 20_000,
  "/assets/users.js": 4_000,
  "/assets/table.js": 6_000,
  "/assets/orgs.js": 3_000,
  "/assets/sign-in.js": 2_000,
};

const measured = measure(
  routes,
  (url) => imports[url] ?? [],
  (url) => gzip[url] ?? 0,
);

describe("check-bundle-size", () => {
  it("reads a chunk's static imports, not its dynamic ones", () => {
    const code = [
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/lazy.js"])))=>i;',
      'import{a as b,c}from"./react-1.js";',
      'import"./side-2.js";',
      'import*as ns from"../vendor/ui-3.js";',
      'export{x}from"./re-4.js";',
      'const lazy=()=>import("./lazy-5.js");',
      'const s="import(\\"./no.js\\")";',
    ].join("");
    expect(staticImports("/assets/entry.js", code)).toEqual([
      "/assets/react-1.js",
      "/assets/side-2.js",
      "/vendor/ui-3.js",
      "/assets/re-4.js",
    ]);
  });

  it("follows static imports transitively, once each", () => {
    const graph: Record<string, string[]> = { a: ["b"], b: ["c", "a"], c: [] };
    expect([...staticClosure(["a"], (url) => graph[url] ?? [])].sort()).toEqual(["a", "b", "c"]);
  });

  it("finds a route's ancestors from the manifest's children", () => {
    expect(routeChain(routes, "/_app/users")).toEqual(["__root__", "/_app", "/_app/users"]);
    expect(routeChain(routes, "__root__")).toEqual(["__root__"]);
  });

  it("measures the shell as the root and /_app with all they import", () => {
    expect(measured.shell).toBe(50_000 + 60_000 + 10_000 + 20_000);
  });

  it("charges each route only for what its parent didn't load", () => {
    expect(measured.routes["/_app/users"]).toBe(4_000 + 6_000); // ui is already in the shell
    expect(measured.routes["/_app/orgs"]).toBe(3_000);
    // A public page sits on the root alone, so the kit it imports counts against it.
    expect(measured.routes["/sign-in"]).toBe(2_000 + 20_000);
    expect(measured.routes["/healthz"]).toBe(0);
    expect(measured.routes).not.toHaveProperty("/_app"); // it is the shell
    expect(measured.routes).not.toHaveProperty("__root__");
  });

  it("suggests the measured size plus 10%, and at least 1 kB more", () => {
    expect(suggestBudget(100_000)).toBe(110);
    expect(suggestBudget(12_345)).toBe(13.6);
    expect(suggestBudget(2_000)).toBe(3);
  });

  it("passes a build within its budgets", () => {
    const budgets = {
      shell: 150,
      newRoute: 10,
      routes: { "/_app/users": 11, "/_app/orgs": 4, "/sign-in": 25 },
    };
    expect(checkBudgets(measured, budgets)).toEqual({
      over: [],
      unbudgeted: [],
      stale: [],
      ok: true,
    });
  });

  it("fails the shell or a route over its budget", () => {
    const result = checkBudgets(measured, {
      shell: 139.9,
      newRoute: 10,
      routes: { "/_app/users": 9.9, "/_app/orgs": 4, "/sign-in": 25 },
    });
    expect(result.ok).toBe(false);
    expect(result.over).toEqual([
      { id: "shell", bytes: 140_000, budget: 139.9 },
      { id: "/_app/users", bytes: 10_000, budget: 9.9 },
    ]);
  });

  it("holds a route without a budget to newRoute, and reports it", () => {
    const within = checkBudgets(measured, {
      shell: 150,
      newRoute: 10,
      routes: { "/_app/users": 11, "/sign-in": 25 },
    });
    expect(within.ok).toBe(true);
    expect(within.unbudgeted).toEqual([{ id: "/_app/orgs", bytes: 3_000 }]);

    const over = checkBudgets(measured, { shell: 150, newRoute: 2, routes: { "/sign-in": 25 } });
    expect(over.ok).toBe(false);
    expect(over.over.map((b) => b.id)).toEqual(["/_app/users", "/_app/orgs"]);
  });

  it("fails a budget for a route the build no longer has", () => {
    const result = checkBudgets(measured, {
      shell: 150,
      newRoute: 10,
      routes: { "/_app/users": 11, "/_app/orgs": 4, "/sign-in": 25, "/_app/gone": 5 },
    });
    expect(result.stale).toEqual(["/_app/gone"]);
    expect(result.ok).toBe(false);
  });

  it("rejects a budgets file it can't trust", () => {
    expect(() => parseBudgets('{"newRoute": 10, "routes": {}}')).toThrow(/shell/);
    expect(() => parseBudgets('{"shell": 1, "newRoute": 10, "routes": {"/a": "big"}}')).toThrow(
      /"\/a"/,
    );
    expect(parseBudgets('{"$comment": "kB", "shell": 1, "newRoute": 2, "routes": {}}').shell).toBe(
      1,
    );
  });
});
