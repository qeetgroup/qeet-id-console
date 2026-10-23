import type { ErrorKind } from "@/platform/errors/error-codes";

type AppErrorInit = {
  httpStatus?: number;
  retryable?: boolean;
  devDetail?: string; // never rendered; logged only in DEV
  cause?: unknown;
};

/**
 * A classified, UI-facing error. Its `kind` lets the UI choose a behaviour (step-up, access
 * boundary, field errors, retry) without re-reading HTTP statuses. Build one with normalizeError().
 */
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
