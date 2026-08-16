import { normalizeError } from "@/platform/errors/normalize-error";
import { logger } from "@/platform/telemetry/logger";

// Capture an error for observability. Reduces any thrown value to its stable
// `code` + `kind` (+ caller context) before logging — the raw backend message /
// dev detail is only kept in DEV. Audit remains server-authoritative; this is
// client diagnostics, never a security record.
export function captureError(error: unknown, context?: Record<string, unknown>) {
  const appError = normalizeError(error);
  logger.error(`error:${appError.kind}:${appError.code}`, {
    ...context,
    httpStatus: appError.httpStatus,
    retryable: appError.retryable,
    ...(import.meta.env?.DEV ? { devDetail: appError.devDetail } : {}),
  });
}
