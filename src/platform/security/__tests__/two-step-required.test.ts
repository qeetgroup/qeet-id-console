import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ApiError } from "@/platform/errors/api-error";
import { getContext } from "@/platform/query/query-client";
import { isTwoStepRequired, TWO_STEP_SETUP_PATH, toastSwitchFailure } from "../two-step-required";

const REQUIRED =
  "This organisation requires two-step verification. Set it up on your account, then try again.";
const withSetUp = expect.objectContaining({
  action: expect.objectContaining({ label: "Set up" }),
});
const refusal = () => new ApiError(403, "mfa.enrollment_required", "raw backend text");

afterEach(() => toastError.mockReset());

describe("two-step verification required", () => {
  it("recognises only the backend's enrolment-required refusal", () => {
    expect(isTwoStepRequired(refusal())).toBe(true);
    expect(isTwoStepRequired(new ApiError(403, "step_up_required", "x"))).toBe(false);
    expect(isTwoStepRequired(new Error("mfa.enrollment_required"))).toBe(false);
  });

  it("tells the person to set it up, with the way to, instead of the generic access toast", async () => {
    const { queryClient } = getContext();
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => Promise.reject(refusal()) })
      .execute(undefined)
      .catch(() => {});
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(REQUIRED, withSetUp);
    expect(TWO_STEP_SETUP_PATH).toBe("/account/security");
  });

  it("reports a refused organisation switch with the setup, and any other refusal plainly", () => {
    toastSwitchFailure(refusal());
    expect(toastError).toHaveBeenNthCalledWith(1, REQUIRED, withSetUp);
    toastSwitchFailure(new Error("private SQL"));
    // One argument only: no setup action, and never the raw text.
    expect(toastError).toHaveBeenNthCalledWith(2, expect.not.stringContaining("private SQL"));
  });
});
