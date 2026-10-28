#!/usr/bin/env node
// Checks a build against bundle-budgets.json (gzip kB): the signed-in shell's initial JS and each
// route's own JS beyond its parent's. Run after `bun run build`; raise a budget only as AGENTS.md
// (Bundle size) says. `--all` lists every route; `--output=<dir>` reads a build other than .output.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

/** The layout route every signed-in page renders inside; its initial JS is the shell. */
export const SHELL_ROUTE = "/_app";
const ROOT_ROUTE = "__root__";

// A static import as Rolldown writes one: `import{a as b}from"./x.js"`, `import"./x.js"` or
// `export{a}from"./x.js"`. A dynamic import("./x.js") loads later, so it doesn't count.
const STATIC_IMPORT =
  /(?:^|[^\w$.])(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["'](\.\.?\/[^"']+\.js)["']/g;

/** Returns the URLs a chunk at `url` imports statically, resolved against it. */
export function staticImports(url, code) {
  const specifiers = [...code.matchAll(STATIC_IMPORT)].map((m) => m[1] ?? "");
  return [...new Set(specifiers.map((s) => new URL(s, `http://build${url}`).pathname))];
}

/** Returns `entries` and every chunk they import statically, transitively: what loads up front. */
export function staticClosure(entries, importsOf) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length > 0) {
    const url = stack.pop();
    if (seen.has(url)) continue;
    seen.add(url);
    stack.push(...importsOf(url));
  }
  return seen;
}

/** Returns the route ids from the root down to `id`, read from the manifest's `children`. */
export function routeChain(routes, id) {
  const parentOf = new Map();
  for (const [parent, route] of Object.entries(routes)) {
    for (const child of route.children ?? []) parentOf.set(child, parent);
  }
  const chain = [];
  for (let at = id; at !== undefined; at = parentOf.get(at)) chain.unshift(at);
  // The manifest leaves out a layout with no client code of its own (a pathless `_auth` that
  // only guards), and with it the link to its pages. They render on the root, so they're
  // measured from it, not skipped as roots.
  if (chain[0] !== ROOT_ROUTE && Object.hasOwn(routes, ROOT_ROUTE)) chain.unshift(ROOT_ROUTE);
  return chain;
}

// The chunks a route asks for itself: its preloads, and the entry script on the root.
function ownChunks(route) {
  const scripts = (route?.scripts ?? []).map((s) => s.attrs?.src).filter(Boolean);
  return [...scripts, ...(route?.preloads ?? [])];
}

/**
 * Measures a build from TanStack Start's route manifest: `shell` is the gzip bytes of the shell's
 * initial JS, and `routes` each route's own gzip bytes beyond its parent's initial JS.
 */
export function measure(routes, importsOf, gzipBytes) {
  const initial = new Map();
  const initialOf = (id) => {
    let chunks = initial.get(id);
    if (!chunks) {
      chunks = staticClosure(
        routeChain(routes, id).flatMap((r) => ownChunks(routes[r])),
        importsOf,
      );
      initial.set(id, chunks);
    }
    return chunks;
  };
  const sum = (chunks) => chunks.reduce((total, url) => total + gzipBytes(url), 0);

  const own = {};
  for (const id of Object.keys(routes)) {
    const parent = routeChain(routes, id).at(-2);
    if (parent === undefined || id === SHELL_ROUTE) continue; // the root and shell count as one
    const base = initialOf(parent);
    own[id] = sum([...initialOf(id)].filter((url) => !base.has(url)));
  }
  return { shell: sum([...initialOf(SHELL_ROUTE)]), routes: own };
}

/** Returns the budget in kB to propose for `bytes`: 10% more, at least 1 kB, up to 0.1 kB. */
export function suggestBudget(bytes) {
  // Whole bytes until the last step, so 100 kB plus 10% is 110, not 110.1.
  const withHeadroom = bytes + Math.max(Math.ceil(bytes / 10), 1000);
  return Math.ceil(withHeadroom / 100) / 10;
}

/**
 * Compares a measurement with the budgets. `over` fails the check, as does a `stale` budget for
 * a route the build no longer has; `unbudgeted` routes are held to `newRoute` until listed.
 */
export function checkBudgets(measured, budgets) {
  const exceeds = (bytes, kB) => bytes > Math.round(kB * 1000);
  const over = [];
  if (exceeds(measured.shell, budgets.shell)) {
    over.push({ id: "shell", bytes: measured.shell, budget: budgets.shell });
  }
  const unbudgeted = [];
  for (const [id, bytes] of Object.entries(measured.routes)) {
    const budget = budgets.routes[id] ?? budgets.newRoute;
    if (!Object.hasOwn(budgets.routes, id) && bytes > 0) unbudgeted.push({ id, bytes });
    if (exceeds(bytes, budget)) over.push({ id, bytes, budget });
  }
  const stale = Object.keys(budgets.routes).filter((id) => !Object.hasOwn(measured.routes, id));
  return { over, unbudgeted, stale, ok: over.length === 0 && stale.length === 0 };
}

/** Parses bundle-budgets.json, throwing on a shape the check can't trust. */
export function parseBudgets(text) {
  const budgets = JSON.parse(text);
  const isKB = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (!isKB(budgets.shell) || !isKB(budgets.newRoute) || typeof budgets.routes !== "object") {
    throw new Error("bundle-budgets.json needs a `shell`, a `newRoute` and a `routes` map (kB).");
  }
  for (const [id, kB] of Object.entries(budgets.routes)) {
    if (!isKB(kB)) throw new Error(`bundle-budgets.json: "${id}" is not a size in kB.`);
  }
  return budgets;
}

// The route manifest the server renders preload links from, in the server build.
function findStartManifest(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findStartManifest(path);
      if (found) return found;
    } else if (/tanstack-start-manifest.*\.m?js$/.test(entry.name)) return path;
  }
  return null;
}

const kB = (bytes) => (bytes / 1000).toFixed(1);

async function main() {
  const outDir = process.argv.find((a) => a.startsWith("--output="))?.slice(9) ?? ".output";
  let manifestFile = null;
  try {
    manifestFile = findStartManifest(join(outDir, "server"));
  } catch {
    // no build output at all
  }
  if (!manifestFile) {
    console.error(`No route manifest under ${outDir}/server: run \`bun run build\` first.`);
    process.exit(1);
  }
  const { tsrStartManifest } = await import(pathToFileURL(manifestFile).href);
  const { routes } = tsrStartManifest();
  if (!routes?.[SHELL_ROUTE]) {
    console.error(`The route manifest has no ${SHELL_ROUTE} route; update SHELL_ROUTE.`);
    process.exit(1);
  }

  const read = (url) => readFileSync(join(outDir, "public", url));
  const imports = new Map();
  const sizes = new Map();
  const importsOf = (url) => {
    if (!imports.has(url)) imports.set(url, staticImports(url, read(url).toString("utf8")));
    return imports.get(url);
  };
  const gzipBytes = (url) => {
    if (!sizes.has(url)) sizes.set(url, gzipSync(read(url)).length);
    return sizes.get(url);
  };

  const measured = measure(routes, importsOf, gzipBytes);
  const budgets = parseBudgets(readFileSync("bundle-budgets.json", "utf8"));
  const { over, unbudgeted, stale, ok } = checkBudgets(measured, budgets);

  const rows = Object.entries(measured.routes)
    .filter(([, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1]);
  console.log(`Bundle budgets, gzip kB (measured / budget), from ${outDir}:`);
  console.log(`  shell (${SHELL_ROUTE} initial JS)  ${kB(measured.shell)} / ${budgets.shell}`);
  const listed = process.argv.includes("--all") ? rows : rows.slice(0, 5);
  for (const [id, bytes] of listed) {
    console.log(`  ${id}  ${kB(bytes)} / ${budgets.routes[id] ?? budgets.newRoute}`);
  }
  if (listed.length < rows.length) console.log(`  … ${rows.length - listed.length} more (--all)`);

  for (const { id, bytes } of unbudgeted) {
    console.log(`No budget yet for ${id} (held to newRoute): add "${id}": ${suggestBudget(bytes)}`);
  }
  for (const { id, bytes, budget } of over) {
    console.error(
      `Over budget: ${id} is ${kB(bytes)} kB, budget ${budget} kB. Make it lazy, or raise it to ` +
        `${suggestBudget(bytes)} in the same change, with the reason (AGENTS.md, Bundle size).`,
    );
  }
  for (const id of stale) console.error(`Stale budget: the build has no route ${id}; remove it.`);
  if (!ok) process.exit(1);
  console.log("Within budget.");
}

if (process.argv[1]?.endsWith("check-bundle-size.mjs")) await main();
