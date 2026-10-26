import { RefreshCwIcon, TriangleAlertIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { ErrorReference } from "@/platform/components/error-reference";
import { StatePage } from "@/platform/components/state-page";
import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";
import { captureError } from "@/platform/telemetry/errors";

/**
 * Renders the router's fallback for an uncaught render or loader error: user-safe copy from the
 * error's code, never the backend message, with its support reference, and the error reported to
 * telemetry.
 */
export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation("common");
  const appError = normalizeError(error);
  captureError(error, { source: "error-boundary" });

  return (
    <StatePage
      tone="danger"
      icon={TriangleAlertIcon}
      title={t("errorComponent.somethingWentWrong")}
      description={userMessageForCode(appError.code, appError.kind)}
      actions={
        <Button icon={RefreshCwIcon} onClick={reset}>
          {t("actions.tryAgain")}
        </Button>
      }
    >
      <ErrorReference error={appError} />
    </StatePage>
  );
}
