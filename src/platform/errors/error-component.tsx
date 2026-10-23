import { useTranslation } from "react-i18next";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@qeetrix/ui";
import { RefreshCwIcon, TriangleAlertIcon } from "@qeetrix/icons";

import { ErrorReference } from "@/platform/components/error-reference";
import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";
import { captureError } from "@/platform/telemetry/errors";
import { PageState } from "@/shared/components/page-state";

/**
 * Renders the router's fallback for an uncaught render or loader error: user-safe copy from the
 * error's code, never the backend message, with the error reported to telemetry.
 */
export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation("common");
  const appError = normalizeError(error);
  captureError(error, { boundary: "root" });

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <PageState
        code="—"
        icon={TriangleAlertIcon}
        title={t("errorComponent.somethingWentWrong")}
        description={
          <>
            {userMessageForCode(appError.code, appError.kind)}
            <ErrorReference error={appError} className="mt-2" />
          </>
        }
        actions={
          <Button onClick={reset}>
            <RefreshCwIcon /> {t("actions.tryAgain")}
          </Button>
        }
      />
    </div>
  );
}
