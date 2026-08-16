import { redact } from "@/platform/telemetry/redact";

// Minimal leveled logger. Every payload passes through `redact` so tokens,
// secrets, credentials and PII can never reach a log sink. In DEV it writes to
// the console; in production it's a no-op sink by default (wire a real transport
// here later — still behind redact()).
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  const safe = context ? (redact(context) as Record<string, unknown>) : undefined;
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](`[${level}] ${message}`, safe ?? "");
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
