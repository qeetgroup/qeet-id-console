#!/usr/bin/env node
// CI's contract gate: the copied documents are the ones source.json records, and the generated
// types are what those documents produce. (Lint holds every call to the typed client.)

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CONTRACT_DIR, DOCUMENTS, GENERATED_DIR, generateTypes, sha256 } from "./contract-lib.mjs";

const root = process.cwd();
const problems = [];

const sourceFile = join(root, CONTRACT_DIR, "source.json");
const source = existsSync(sourceFile) ? JSON.parse(readFileSync(sourceFile, "utf8")) : null;
if (!source)
  problems.push(`${CONTRACT_DIR}/source.json is missing: run \`bun run contract:sync\`.`);

for (const name of DOCUMENTS) {
  const doc = join(root, CONTRACT_DIR, `${name}.yaml`);
  if (!existsSync(doc)) {
    problems.push(`${CONTRACT_DIR}/${name}.yaml is missing: run \`bun run contract:sync\`.`);
    continue;
  }
  if (source && source.documents?.[name] !== sha256(doc)) {
    problems.push(
      `${CONTRACT_DIR}/${name}.yaml isn't the copy source.json records: never edit it, run ` +
        "`bun run contract:sync`.",
    );
  }
  const generated = join(root, GENERATED_DIR, `${name}.gen.ts`);
  const expected = await generateTypes(root, name);
  if (!existsSync(generated) || readFileSync(generated, "utf8") !== expected) {
    problems.push(
      `${GENERATED_DIR}/${name}.gen.ts is stale or edited: run \`bun run contract:sync\`.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`API contract check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
// What the server sends or accepts beyond its documents, for the server to document.
const undocumented = readFileSync(join(root, "src/platform/api/contract/undocumented.ts"), "utf8");
const gaps = [...undocumented.matchAll(/^[ \t]*"(GET|POST|PUT|PATCH|DELETE) \//gm)].length;
console.log(
  `API contract: documents from qeet-id-server ${source.commit.slice(0, 12)}, types current, ` +
    `${gaps} operations with undocumented fields.`,
);
