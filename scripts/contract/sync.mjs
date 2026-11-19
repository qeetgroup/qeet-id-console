#!/usr/bin/env node
// Copies the server's five API documents into contract/, records the commit they came from, and
// regenerates their TypeScript. The server's checkout is ../qeet-id-server, or QEET_ID_SERVER_DIR.

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { CONTRACT_DIR, DOCUMENTS, GENERATED_DIR, generateTypes, sha256 } from "./contract-lib.mjs";

const root = process.cwd();
const server = resolve(process.env.QEET_ID_SERVER_DIR ?? join(root, "..", "qeet-id-server"));
const from = join(server, "api", "openapi");
if (!existsSync(from)) {
  console.error(`No API documents at ${from}. Set QEET_ID_SERVER_DIR to the server's checkout.`);
  process.exit(1);
}

const git = (...args) => execFileSync("git", ["-C", server, ...args], { encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const changed = git("status", "--porcelain", "--", "api/openapi");
if (changed) {
  console.error(`The server's api/openapi has uncommitted changes; commit them first:\n${changed}`);
  process.exit(1);
}

mkdirSync(join(root, CONTRACT_DIR), { recursive: true });
mkdirSync(join(root, GENERATED_DIR), { recursive: true });
const documents = {};
for (const name of DOCUMENTS) {
  const target = join(root, CONTRACT_DIR, `${name}.yaml`);
  copyFileSync(join(from, `${name}.yaml`), target);
  chmodSync(target, 0o644); // the server's checkout may hold it owner-only
  documents[name] = sha256(target);
  writeFileSync(join(root, GENERATED_DIR, `${name}.gen.ts`), await generateTypes(root, name));
}
const source = { repository: "qeetgroup/qeet-id-server", commit, documents };
writeFileSync(join(root, CONTRACT_DIR, "source.json"), `${JSON.stringify(source, null, 2)}\n`);
console.log(`Contract synced from qeet-id-server ${commit.slice(0, 12)}; types regenerated.`);
console.log("Run `bun run typecheck`: every typed call that no longer matches fails there.");
