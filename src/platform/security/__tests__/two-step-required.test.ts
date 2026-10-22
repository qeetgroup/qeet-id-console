import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ApiError } from "@/platform/errors/api-error";
import { getContext } from "@/platform/query/query-client";
import { isTwoStepRequired, TWO_STEP_SETUP_PATH } from "../two-step-required";

afterEach(() => toastError.mockReset());

describe("two-step verification required", () => {
  it("recognises only the backend's enrolment-required refusal", () => {
    expect(isTwoStepRequired(new ApiError(403, "mfa.enrollment_required", "x"))).toBe(true);
    expect(isTwoStepRequired(new ApiError(403, "step_up_required", "x"))).toBe(false);
    expect(isTwoStepRequired(new Error("mfa.enrollment_required"))).toBe(false);
  });

  it("tells the person to set it up, with the way to, instead of the generic access toast", async () => {
    const { queryClient } = getContext();
    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () =>
          Promise.reject(new ApiError(403, "mfa.enrollment_required", "raw backend text")),
      })
      .execute(undefined)
      .catch(() => {});
    expect(toastError).toHaveBeenCalledTimes(1);
    const [message, options] = toastError.mock.calls[0];
    expect(message).toBe(
      "This organization requires two-step verification. Set it up on your account, then try again.",
    );
    expect(options.action.label).toBe("Set up");
    expect(TWO_STEP_SETUP_PATH).toBe("/account/security");
  });
});
