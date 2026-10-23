import { toast } from "sonner";

import i18n from "@/i18n";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";

/**
 * Toasts the user-safe message for an error with its support reference. With a `title`, the
 * message moves into the description under it.
 */
export function toastError(err: unknown, title?: string): void {
  const appError = normalizeError(err);
  // A cancelled step-up already told the person nothing was changed.
  if (appError.code === ERROR_CODES.STEP_UP_REQUIRED) return;
  const message = userMessageForCode(appError.code, appError.kind);
  const reference = appError.requestId
    ? i18n.t("errors:toast.reference", { id: appError.requestId })
    : undefined;
  if (title) toast.error(title, { description: reference ? `${message} ${reference}` : message });
  else if (reference) toast.error(message, { description: reference });
  else toast.error(message);
}
