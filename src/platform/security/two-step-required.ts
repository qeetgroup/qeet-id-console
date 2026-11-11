import { toast } from "sonner";

import i18n from "@/i18n";
import { ApiError } from "@/platform/errors/api-error";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { errorMessage } from "@/platform/errors/user-message";

// An organisation that requires two-step verification refuses someone who has set up no second
// factor: entering it (switching in, accepting its invitation) answers 403
// `mfa.enrollment_required`. Unlike a missing permission, the person can fix it themselves: set
// up a factor on their account, then try again.

/** Where a person sets up a second factor for their account. */
export const TWO_STEP_SETUP_PATH = "/account/security";

/** True when an error is the backend's "set up two-step verification first". */
export function isTwoStepRequired(err: unknown): boolean {
  return err instanceof ApiError && err.code === ERROR_CODES.MFA_ENROLLMENT_REQUIRED;
}

/** Tells the person to set up two-step verification, with the way to do it. */
export function toastTwoStepRequired(): void {
  toast.error(i18n.t("errors:code.mfaEnrollmentRequired"), {
    action: {
      label: i18n.t("errors:toast.setUpTwoStep"),
      onClick: () => {
        window.location.href = TWO_STEP_SETUP_PATH;
      },
    },
  });
}

/** Reports a refused organisation switch: the two-step setup when that's why, else the error. */
export function toastSwitchFailure(err: unknown): void {
  if (isTwoStepRequired(err)) toastTwoStepRequired();
  else toast.error(errorMessage(err));
}
