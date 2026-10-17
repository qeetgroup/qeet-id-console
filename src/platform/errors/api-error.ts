// Transport-level error thrown by the platform HTTP client. Normalises the
// backend's `error` envelope into a typed shape so React Query / form handlers
// can switch on `err.status` / `err.code`. Higher-level classification (auth vs
// authz vs validation vs network) is layered on top in `normalize-error.ts`.
export class ApiError extends Error {
  status: number;
  /** Stable machine code from the API (e.g. "mfa.code_invalid") — branch/localize on this. */
  code: string;
  /** Developer-facing context from the API's `detail` field, when present. */
  detail?: string;
  /** True when the API marks the failure as safe to retry (e.g. session refresh). */
  retryable: boolean;
  /** Structured context from the API's `metadata` field (e.g. `retry_after`, `allowed_methods`). */
  metadata?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    detail?: string,
    retryable = false,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.retryable = retryable;
    this.metadata = metadata;
  }
}
