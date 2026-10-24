import { useTranslation } from "react-i18next";

import { useSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { type AuthPolicy, useUpdateAuthPolicy } from "../api/auth-policy";

/**
 * Saves the auth policy behind a step-up. PUT replaces the whole object, so a page passes its
 * slice merged into the latest policy it loaded; `run` resolves with the saved policy.
 */
export function useSaveAuthPolicy() {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const updateM = useUpdateAuthPolicy();
  return {
    error: updateM.error,
    run: (policy: AuthPolicy) =>
      runSensitive({
        actionLabel: t("loginMethods.stepUp.savePolicy"),
        run: () => updateM.mutateAsync(policy),
      }),
  };
}
