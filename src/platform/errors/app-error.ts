import type { ErrorKind } from "@/platform/errors/error-codes";

// A classified, UI-facing error. `ApiError` (platform/errors/api-error) stays
// the raw transport shape; `AppError` layers a `kind` on top so the UI can
// decide behaviour (auth → step-up/redirect, authz → access boundary,
// validation → inline field errors, network → retry, …) without re-parsing
// HTTP status codes everywhere. Build one via normalizeError().
type AppErrorInit = {
  httpStatus?: number;
  retryable?: boolean;
  /** Developer-facing detail — NEVER rendered to end users (log-only, DEV-gated). */
  devDetail?: string;
  cause?: unknown;
};

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly devDetail?: string;

  constructor(kind: ErrorKind, code: string, message: string, init: AppErrorInit = {}) {
    super(message, { cause: init.cause });
    this.name = "AppError";
    this.kind = kind;
    this.code = code;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable ?? false;
    this.devDetail = init.devDetail;
  }
}
