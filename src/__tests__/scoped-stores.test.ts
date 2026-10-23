import { describe, expect, it } from "vitest";

// Every hand-written source file, as text.
const sources = import.meta.glob<string>(
  ["/src/**/*.{ts,tsx}", "!/src/**/__tests__/**", "!/src/**/*.test.{ts,tsx}"],
  { query: "?raw", import: "default", eager: true },
);

// Stores that hold only this device's preferences, which outlive a sign-out or switch on purpose.
const DEVICE_PREFERENCES = new Set(["/src/modules/qeetai/store/workspace-store.ts"]);

describe("in-memory stores", () => {
  it("drop what they hold when the person or organization changes", () => {
    const unscoped = Object.entries(sources)
      .filter(([path, text]) => /new Store\b/.test(text) && !DEVICE_PREFERENCES.has(path))
      .filter(([, text]) => !/onSessionClear\(|onScopeChange:/.test(text))
      .map(([path]) => path);
    expect(unscoped).toEqual([]);
  });
});
