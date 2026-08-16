import { ApiError } from "@/platform/errors/api-error";
import { AppError } from "@/platform/errors/app-error";
import { type ErrorKind, ERROR_CODES } from "@/platform/errors/error-codes";

function classifyApiError(err: ApiError): ErrorKind {
  // Order matters: step-up and 401 are auth; 403 is authz (even for `auth.*`
  // codes like auth.forbidden); 400/422 are validation; everything else is api.
  if (err.code === ERROR_CODES.STEP_UP_REQUIRED) return "auth";
  if (err.status === 401) return "auth";
  if (err.status === 403) return "authz";
  if (err.status === 400 || err.status === 422) return "validation";
  return "api";
}

/**
 * Coerce any thrown value into a classified `AppError`. This is the single point
 * where transport/JS errors become UI-actionable ones. Rules:
 *  - AppError            → passthrough
 *  - ApiError            → classify by code/status (auth/authz/validation/api)
 *  - fetch TypeError     → network (the request never got a response)
 *  - anything else       → unknown
 * `message` is preserved for logging; user-facing copy comes from
 * userMessageForCode(), never from the raw message.
 */
export function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ApiError) {
    return new AppError(classifyApiError(err), err.code, err.message, {
      httpStatus: err.status,
      retryable: err.retryable,
      devDetail: err.detail,
      cause: err,
    });
  }

  // A fetch that never completed (offline, DNS, CORS preflight) rejects with a
  // TypeError and no Response — treat as a network error, not an API error.
  if (err instanceof TypeError) {
    return new AppError("network", ERROR_CODES.NETWORK, err.message, {
      retryable: true,
      cause: err,
    });
  }

  return new AppError(
    "unknown",
    ERROR_CODES.UNKNOWN,
    err instanceof Error ? err.message : String(err),
    {
      cause: err,
    },
  );
}
