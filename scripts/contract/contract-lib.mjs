// The console's copy of the server's API contract: the five OpenAPI documents in contract/ and the
// TypeScript types generated from them. Every call is typed against them: lint refuses the
// untyped transport (`api` from @/platform/api/client) outside the typed client.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const DOCUMENTS = ["access", "identity", "federation", "developer", "operations"];
export const CONTRACT_DIR = "contract/qeet-id-server";
export const GENERATED_DIR = "src/platform/api/contract/generated";

/** Returns the sha256 of a file's bytes, hex. */
export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Returns the generated TypeScript for one document, header first. */
export async function generateTypes(root, name) {
  const { default: openapiTS, astToString } = await import("openapi-typescript");
  const source = pathToFileURL(join(root, CONTRACT_DIR, `${name}.yaml`));
  const ast = await openapiTS(source, { alphabetize: true });
  const header = [
    `// Generated from ${CONTRACT_DIR}/${name}.yaml by \`bun run contract:sync\`. Do not edit:`,
    "// `bun run contract:check` fails when this file and the document disagree.",
    "",
  ].join("\n");
  return `${header}${astToString(ast)}`;
}
