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

// What browsers (and the server's own fetch) say of a request that never completed: offline, DNS,
// a refused connection. Any other TypeError is a fault in the page, not the connection.
const FETCH_FAILURE =
  /^(failed to fetch|load failed|fetch failed|network ?error when attempting to fetch resource\.?|network request failed)$/i;

/** True for a request that never reached the server, as opposed to one it answered. */
export function isFetchFailure(err: unknown): err is TypeError {
  return err instanceof TypeError && FETCH_FAILURE.test(err.message.trim());
}

/**
 * True for a failure that may pass on its own: the connection, or a server error. A refusal, a
 * missing record or an answer that isn't what the contract says won't change by asking again.
 */
export function isTransientFailure(err: unknown): boolean {
  if (isFetchFailure(err)) return true;
  return err instanceof ApiError && (err.retryable || err.status >= 500);
}

/**
 * Coerces any thrown value into a classified AppError: an ApiError by code and status, a failed
 * fetch as network, anything else (a fault in the page included) as unknown. `message` is kept
 * for logs only; user-facing copy comes from userMessageForCode().
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

  // A fetch that never completed rejects with a TypeError and no Response: a network error, not an
  // API one. A TypeError from the page's own code reads as unknown, not as the person's connection.
  if (isFetchFailure(err)) {
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
