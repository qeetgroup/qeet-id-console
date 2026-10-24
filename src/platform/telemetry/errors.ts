import { normalizeError } from "@/platform/errors/normalize-error";
import { type CaughtErrorSource, reportCaughtError } from "@/platform/telemetry/client-reporter";
import { logger } from "@/platform/telemetry/logger";

/**
 * Logs an error reduced to its stable `code` and `kind`, never its message, with the dev detail
 * in DEV only; in a production browser it is also reported to the console's server log.
 */
export function captureError(error: unknown, context: { source: CaughtErrorSource }) {
  const appError = normalizeError(error);
  logger.error(`error:${appError.kind}:${appError.code}`, {
    ...context,
    httpStatus: appError.httpStatus,
    retryable: appError.retryable,
    requestId: appError.requestId,
    ...(import.meta.env?.DEV ? { devDetail: appError.devDetail } : {}),
  });
  reportCaughtError(error, context.source);
}
