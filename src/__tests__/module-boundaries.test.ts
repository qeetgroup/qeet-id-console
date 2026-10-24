import { describe, expect, it } from "vitest";

// Every source file, tests included, as text.
const sources = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "!/src/routeTree.gen.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const SPECIFIER = /(?:from|import\(|vi\.mock\(|vi\.importActual\()\s*["']([^"']+)["']/g;
const isTest = (path: string) => /\/__tests__\/|\.test\.tsx?$/.test(path);

function specifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map((m) => m[1] ?? "");
}

describe("module boundaries", () => {
  // Biome can't tell a module's own files from another's, so this does: a module reaches another
  // only through its barrel (@/modules/<name>), and its own files through @/modules/<own>/….
  it("reaches another module only through its barrel", () => {
    const violations = Object.entries(sources)
      .filter(([path]) => path.startsWith("/src/modules/") && !isTest(path))
      .flatMap(([path, text]) => {
        const own = path.split("/")[3];
        return specifiers(text)
          .map((spec) => /^@\/modules\/([^/]+)\/(.+)$/.exec(spec))
          .filter((m): m is RegExpExecArray => m !== null && m[1] !== own)
          .map((m) => `${path} → ${m[0]}`);
      });
    expect(violations).toEqual([]);
  });

  it("never climbs more than one folder: a farther file is imported through @/", () => {
    const deep = Object.entries(sources).flatMap(([path, text]) =>
      specifiers(text)
        .filter((spec) => spec.startsWith("../../"))
        .map((spec) => `${path} → ${spec}`),
    );
    expect(deep).toEqual([]);
  });
});
