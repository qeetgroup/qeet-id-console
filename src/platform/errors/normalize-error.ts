import { ApiError } from "@/platform/errors/api-error";
import { AppError } from "@/platform/errors/app-error";
import { type ErrorKind, ERROR_CODES } from "@/platform/errors/error-codes";

function classifyApiError(err: ApiError): ErrorKind {
  // Order matters: a step-up refusal is auth whatever its status, and a 403 is authz even for
  // `auth.*` codes such as auth.forbidden.
  if (err.code === ERROR_CODES.STEP_UP_REQUIRED) return "auth";
  if (err.status === 401) return "auth";
  if (err.status === 403) return "authz";
  if (err.status === 400 || err.status === 422) return "validation";
  return "api";
}

/**
 * Coerces any thrown value into a classified AppError: an ApiError by code and status, a fetch
 * TypeError as network, anything else as unknown. `message` is kept for logs only; user-facing
 * copy comes from userMessageForCode().
 */
export function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ApiError) {
    return new AppError(classifyApiError(err), err.code, err.message, {
      httpStatus: err.status,
      retryable: err.retryable,
      devDetail: err.detail,
      requestId: err.requestId,
      fields: err.fields,
      cause: err,
    });
  }

  // A fetch that never completed (offline, DNS, CORS preflight) rejects with a TypeError and no
  // Response: a network error, not an API one.
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
