import { afterEach, describe, expect, it, vi } from "vitest";

import { _setServerLogSinkForTest, serverLog } from "../server-log";

afterEach(() => {
  _setServerLogSinkForTest(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function capture(): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  _setServerLogSinkForTest((line) => lines.push(JSON.parse(line)));
  return lines;
}

describe("serverLog", () => {
  it("writes nothing in a test run unless a test asks", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    serverLog("info", "api.request", { status: 200 });
    expect(write).not.toHaveBeenCalled();
  });

  it("writes one JSON line per event: time, level, event, then the fields", () => {
    const lines = capture();
    serverLog("warn", "session.refresh", { requestId: "req-1", outcome: "rejected" });

    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0] ?? {})).toEqual(["ts", "level", "event", "requestId", "outcome"]);
    expect(lines[0]).toMatchObject({
      level: "warn",
      event: "session.refresh",
      requestId: "req-1",
      outcome: "rejected",
    });
    expect(Number.isNaN(Date.parse(String(lines[0]?.ts)))).toBe(false);
  });

  it("redacts every field before it is written", () => {
    const lines = capture();
    serverLog("error", "client.error", {
      accessToken: "access-secret",
      cookie: "__Host-qeet_console=sealed",
      message: "jane@acme.io from 10.0.0.4 sent Bearer eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1In0.c2ln",
    });

    const written = JSON.stringify(lines);
    expect(written).not.toContain("access-secret");
    expect(written).not.toContain("sealed");
    expect(written).not.toContain("jane@acme.io");
    expect(written).not.toContain("10.0.0.4");
    expect(written).not.toContain("eyJhbGciOiJFUzI1NiJ9");
    expect(lines[0]).toMatchObject({ accessToken: "[redacted]", cookie: "[redacted]" });
  });

  it("never throws, even when the sink fails", () => {
    _setServerLogSinkForTest(() => {
      throw new Error("stdout closed");
    });
    expect(() => serverLog("info", "api.request")).not.toThrow();
  });

  it("writes to stdout in a production build", async () => {
    vi.stubEnv("PROD", true);
    vi.resetModules();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const production = await import("../server-log");

    production.serverLog("info", "api.request", { status: 204 });

    expect(write).toHaveBeenCalledTimes(1);
    const line = String(write.mock.calls[0]?.[0]);
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toMatchObject({ event: "api.request", status: 204 });
  });
});
