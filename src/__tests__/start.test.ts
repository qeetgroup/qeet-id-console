import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the production start-up check", () => {
  it("logs each problem by its variable, never its value, then refuses to start", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "too-short-secret");
    vi.stubEnv("SERVER_URL", "");
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("PUBLIC_API_URL", "not a url");
    vi.resetModules();
    // The same fresh module instance that src/start.ts is about to load.
    const { _setServerLogSinkForTest } = await import("@/platform/telemetry/server-log");
    const lines: string[] = [];
    _setServerLogSinkForTest((line) => lines.push(line));

    await expect(import("../start")).rejects.toThrow("Refusing to start");

    expect(lines.map((line) => JSON.parse(line))).toEqual([
      {
        ts: expect.any(String),
        level: "error",
        event: "config.invalid",
        problems: [
          expect.stringContaining("SESSION_SECRET"),
          expect.stringContaining("SERVER_URL"),
          expect.stringContaining("PUBLIC_API_URL"),
        ],
      },
    ]);
    expect(lines.join("\n")).not.toContain("too-short-secret");
  });
});
