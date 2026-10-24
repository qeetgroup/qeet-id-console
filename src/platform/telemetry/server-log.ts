// The server's structured log: one JSON line per event on stdout, which Vercel and the container
// both collect. Production builds only; DEV keeps its console output, and a test run stays silent
// unless a test installs a sink. The marker fails the build if this reaches the browser bundle.
import "@tanstack/react-start/server-only";

import { redact } from "@/platform/telemetry/redact";

export type ServerLogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown> & { ts?: never; level?: never; event?: never };

type Sink = (line: string) => void;

const stdout: Sink = (line) => {
  process.stdout.write(`${line}\n`);
};

let sink: Sink | null = import.meta.env.PROD ? stdout : null;

/** Writes one event as a JSON line, every field redacted first. Never throws. */
export function serverLog(level: ServerLogLevel, event: string, fields: LogFields = {}): void {
  if (!sink) return;
  try {
    const safe = redact(fields) as Record<string, unknown>;
    sink(JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe }));
  } catch {
    // A log line must never fail the request it describes.
  }
}

/** Sends the log to `next` instead (null silences it); for tests. */
export function _setServerLogSinkForTest(next: Sink | null): void {
  sink = next;
}
