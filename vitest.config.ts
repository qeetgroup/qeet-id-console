import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so unit tests run without the Start and Nitro plugins.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Playwright specs live in tests/e2e; .claude/worktrees holds whole copies of this repository.
    exclude: [...configDefaults.exclude, "tests/e2e/**", ".claude/**"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/routeTree.gen.ts",
        "src/test-setup.ts",
        "src/**/*.d.ts",
      ],
      reporter: ["text-summary", "json-summary"],
      // Floors at the measured coverage, so it can only go up; the security-critical platform
      // folders carry higher ones. CI runs the tests in shards (COVERAGE_SHARD=1), each covering a
      // slice, so the floors hold on the merged report (`vitest --merge-reports --coverage`).
      thresholds:
        process.env.COVERAGE_SHARD === "1"
          ? undefined
          : {
              lines: 41,
              statements: 41,
              branches: 40,
              functions: 34,
              "src/platform/api/**": { lines: 80, statements: 77, branches: 76, functions: 70 },
              "src/platform/auth/**": { lines: 65, statements: 62, branches: 67, functions: 60 },
              "src/platform/security/**": {
                lines: 64,
                statements: 64,
                branches: 61,
                functions: 61,
              },
            },
    },
  },
});
