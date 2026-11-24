#!/usr/bin/env node
// Says whether the server's API documents have moved on since the console's copy: compares the
// documents in the server checkout beside this one (../qeet-id-server) with source.json. Run by
// hand before a sync or a release; the console takes new documents with `bun run contract:sync`
// when it is ready to speak them.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { CONTRACT_DIR, DOCUMENTS, sha256 } from "./contract-lib.mjs";

const root = process.cwd();
const server = resolve(root, "..", "qeet-id-server");
const source = JSON.parse(readFileSync(join(root, CONTRACT_DIR, "source.json"), "utf8"));

const moved = DOCUMENTS.filter((name) => {
  const doc = join(server, "api", "openapi", `${name}.yaml`);
  return !existsSync(doc) || sha256(doc) !== source.documents?.[name];
});

if (moved.length === 0) {
  console.log(`The server's API documents match the copy (${source.commit.slice(0, 12)}).`);
} else {
  const line =
    `The server's ${moved.join(", ")} document${moved.length === 1 ? " has" : "s have"} changed ` +
    `since the copy (${source.commit.slice(0, 12)}): run \`bun run contract:sync\` to speak them.`;
  console.log(line);
}
