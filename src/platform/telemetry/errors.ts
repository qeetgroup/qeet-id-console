import { normalizeError } from "@/platform/errors/normalize-error";
import { logger } from "@/platform/telemetry/logger";

/**
 * Logs an error reduced to its stable `code` and `kind` plus caller context, never its message;
 * the dev detail is added only in DEV. Client diagnostics, not a security record.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  const appError = normalizeError(error);
  logger.error(`error:${appError.kind}:${appError.code}`, {
    ...context,
    httpStatus: appError.httpStatus,
    retryable: appError.retryable,
    ...(import.meta.env?.DEV ? { devDetail: appError.devDetail } : {}),
  });
}
