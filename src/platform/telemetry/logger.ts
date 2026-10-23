import { redact } from "@/platform/telemetry/redact";

// Writes to the console in DEV and nowhere in production. The context argument is redacted;
// the message string is not, so it must never carry data.
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  const safe = context ? (redact(context) as Record<string, unknown>) : undefined;
  if (import.meta.env?.DEV) {
    console[level === "debug" ? "log" : level](`[${level}] ${message}`, safe ?? "");
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
