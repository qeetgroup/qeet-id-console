#!/usr/bin/env node
// Analyses the console with the local SonarQube that qeet-id-server runs (`make sonar-up` there):
// the unit tests with coverage, then the SonarQube scanner in Docker over this repository, with
// sonar-project.properties. SONAR_TOKEN reaches the scanner by name only, never on a command line.
// SONAR_HOST_URL overrides where SonarQube is.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The scanner image, pinned as qeet-id-server pins it. */
export const SCANNER_IMAGE =
  "sonarsource/sonar-scanner-cli:12.3.1.4302_8.3.1@sha256:38207bba3d98c8ce6f6c051ea2b9f05a24480da78c9ee5945ceafc3d9de02b88";

/** The server's SonarQube, as a container reaches the host. */
export const DEFAULT_HOST_URL = "http://host.docker.internal:9000";

/** The `docker` arguments that scan `dir`; the token is named, so Docker reads it from the environment. */
export function scannerArgs(dir, hostUrl = DEFAULT_HOST_URL) {
  return [
    "run",
    "--rm",
    // Docker Desktop knows host.docker.internal; on Linux this maps it to the host.
    "--add-host=host.docker.internal:host-gateway",
    "-e",
    `SONAR_HOST_URL=${hostUrl}`,
    "-e",
    "SONAR_TOKEN",
    "-v",
    `${dir}:/usr/src`,
    SCANNER_IMAGE,
  ];
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    console.error(`Couldn't run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  if (!process.env.SONAR_TOKEN) {
    console.error(
      "SONAR_TOKEN is unset: create a token in SonarQube (My Account › Security) and set it in " +
        "your environment, then run `bun run sonar` again.",
    );
    process.exit(1);
  }
  const dir = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "");
  run("bun", ["run", "test:coverage"]);
  run("docker", scannerArgs(dir, process.env.SONAR_HOST_URL || DEFAULT_HOST_URL));
}

if (process.argv[1]?.endsWith("sonar.mjs")) main();
