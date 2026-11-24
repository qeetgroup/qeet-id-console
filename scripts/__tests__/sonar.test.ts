import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_HOST_URL, SCANNER_IMAGE, scannerArgs } from "../sonar.mjs";

const saved = process.env.SONAR_TOKEN;
afterEach(() => {
  if (saved === undefined) delete process.env.SONAR_TOKEN;
  else process.env.SONAR_TOKEN = saved;
});

describe("sonar", () => {
  it("names the token for Docker to read, and never carries its value", () => {
    process.env.SONAR_TOKEN = "squ_never-on-a-command-line";
    const args = scannerArgs("/work/qeet-id-console");
    expect(args).toContain("SONAR_TOKEN");
    expect(args.join(" ")).not.toContain("squ_never-on-a-command-line");
    expect(args.some((arg) => arg.startsWith("SONAR_TOKEN="))).toBe(false);
  });

  it("scans the repository with the pinned scanner, on the server's SonarQube by default", () => {
    const args = scannerArgs("/work/qeet-id-console");
    expect(args).toContain("/work/qeet-id-console:/usr/src");
    expect(args).toContain(`SONAR_HOST_URL=${DEFAULT_HOST_URL}`);
    expect(args.at(-1)).toBe(SCANNER_IMAGE);
    expect(SCANNER_IMAGE).toMatch(/^sonarsource\/sonar-scanner-cli:[\w.]+@sha256:[0-9a-f]{64}$/);
  });

  it("takes another SonarQube", () => {
    expect(scannerArgs("/w", "https://sonar.example")).toContain(
      "SONAR_HOST_URL=https://sonar.example",
    );
  });
});
