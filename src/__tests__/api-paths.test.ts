import { describe, expect, it } from "vitest";

// The console's server refuses an API path that carries its own query string
// (src/platform/api/server-proxy.ts), so a filter goes in api()'s `query` option. A query in the
// path fails only when the request runs, and a test that mocks api() never sees it, so this reads
// the source.
const sources = import.meta.glob<string>(
  ["/src/**/*.{ts,tsx}", "!/src/**/__tests__/**", "!/src/**/*.test.{ts,tsx}"],
  { query: "?raw", import: "default", eager: true },
);

describe("API paths", () => {
  it("never carry a query string: filters go in api()'s query option", () => {
    const offenders = Object.entries(sources).flatMap(([file, text]) =>
      // `?name=` or `?${params}` after the path; a ternary inside `${…}` isn't a query.
      [...text.matchAll(/\bapi(?:<.*?>)?\(\s*[`"'][^`"'\n]*\?(?:[\w-]+=|\$\{)/g)].map(
        (m) => `${file}: ${m[0]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
