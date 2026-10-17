import type { ApiError } from "@/platform/errors/api-error";

// The one place a backend `step_up_required` refusal is turned into a prompt.
// The API client hands every such refusal here; the app shell registers the
// handler that opens the step-up dialog (SensitiveActionProvider). When the
// person confirms, the client sends the refused request once more — safe,
// because a refused request never ran. Concurrent refusals share one prompt.
// Kept free of the API client's own imports so the client can depend on it.

export type StepUpRequest = {
  /** The factor types the organisation counts; null when every one does. */
  allowedMethods: string[] | null;
};

type Handler = (request: StepUpRequest) => Promise<boolean>;

let handler: Handler | null = null;
let pending: Promise<boolean> | null = null;

/** Register (or, with null, remove) the prompt that meets a step-up refusal. */
export function registerStepUpHandler(next: Handler | null): void {
  handler = next;
  // A prompt the previous handler still had open can never answer now.
  pending = null;
}

/** The step-up a refusal asks for, read from its metadata. */
export function stepUpRequestOf(err: ApiError): StepUpRequest {
  const allowed = err.metadata?.allowed_methods;
  return {
    allowedMethods: Array.isArray(allowed)
      ? allowed.filter((m): m is string => typeof m === "string")
      : null,
  };
}

/**
 * Ask the person to step up for a refused request. Resolves true once they
 * have, false when they cancel or when nothing can ask (no handler, e.g. on the
 * server).
 */
export function requestStepUp(err: ApiError): Promise<boolean> {
  if (!handler) return Promise.resolve(false);
  if (!pending) {
    pending = handler(stepUpRequestOf(err)).finally(() => {
      pending = null;
    });
  }
  return pending;
}
