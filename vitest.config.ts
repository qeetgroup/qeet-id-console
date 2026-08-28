import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

/** Keep unit tests independent from TanStack Start/Nitro application plugins. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    setupFiles: ["./src/test-setup.ts"],
  },
});
