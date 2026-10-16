import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@qeetrix/ui";
import { RefreshCwIcon, TriangleAlertIcon } from "@qeetrix/icons";

import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";
import { captureError } from "@/platform/telemetry/errors";
import { PageState } from "@/shared/components/page-state";

/**
 * Router-level fallback for uncaught render/loader throws. Wired as the router's
 * `defaultErrorComponent`, so a thrown error renders this instead of a blank
 * page. It shows only user-safe copy derived from the error's stable code —
 * never the raw backend message — and reports the detail via telemetry.
 */
export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const appError = normalizeError(error);
  captureError(error, { boundary: "root" });

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <PageState
        code="—"
        icon={TriangleAlertIcon}
        title="Something went wrong"
        description={userMessageForCode(appError.code, appError.kind)}
        actions={
          <Button onClick={reset}>
            <RefreshCwIcon /> Try again
          </Button>
        }
      />
    </div>
  );
}
