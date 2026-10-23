/**
 * The backend's `error` envelope as thrown by the API client; normalizeError() classifies it.
 * `message` is the backend's own text: never render it, use userMessageForCode().
 */
export class ApiError extends Error {
  status: number;
  code: string; // stable code, e.g. "mfa.code_invalid": branch and localize on it
  detail?: string; // developer context from the API's `detail` field
  retryable: boolean; // the API marks the failure safe to retry
  metadata?: Record<string, unknown>; // structured context such as `retry_after`

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
