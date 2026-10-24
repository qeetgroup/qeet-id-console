import type { ApiError } from "@/platform/errors/api-error";

// Turns a backend `step_up_required` refusal into one prompt, shared by concurrent refusals. Once
// the person confirms, the client resends the request: safe, as a refused request never ran.
// Free of the API client's imports so the client can depend on it.

export type StepUpRequest = {
  allowedMethods: string[] | null; // factor types the organisation counts; null = all
};

type Handler = (request: StepUpRequest) => Promise<boolean>;

let handler: Handler | null = null;
let pending: Promise<boolean> | null = null;

/** Registers, or with null removes, the prompt that meets a step-up refusal. */
export function registerStepUpHandler(next: Handler | null): void {
  handler = next;
  // A prompt the previous handler still had open can never answer now.
  pending = null;
}

/** Returns the step-up a refusal asks for, read from its `allowed_methods` metadata. */
export function stepUpRequestOf(err: ApiError): StepUpRequest {
  const allowed = err.metadata?.allowed_methods;
  return {
    allowedMethods: Array.isArray(allowed)
      ? allowed.filter((m): m is string => typeof m === "string")
      : null,
  };
}

/**
 * Asks the person to step up for a refused request. Resolves true once they have, false when
 * they cancel or nothing can ask (no handler, as on the server).
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
