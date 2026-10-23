import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@qeetrix/ui";
import { RefreshCwIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { DirectoryEvent } from "../api/directory";
import { DirectoryStatus } from "./directory-ui";

/** One sync error, with resolve and retry for an open one. */
export function SyncErrorSheet({
  event,
  nameFor,
  canWrite,
  acting,
  onAction,
  onClose,
}: {
  event: DirectoryEvent | null;
  nameFor: (connectionId: string) => string;
  canWrite: boolean;
  acting: boolean;
  onAction: (events: DirectoryEvent[], action: "retry" | "resolve") => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("directory.errors.detailTitle")}</SheetTitle>
          <SheetDescription>{event ? nameFor(event.connection_id) : ""}</SheetDescription>
        </SheetHeader>
        {event ? (
          <div className="space-y-5 p-5 text-sm">
            <code>{event.error_code}</code>
            <p>{event.message}</p>
            <DirectoryStatus
              label={t(`directory.errors.${event.resolution}`)}
              tone={event.resolution === "open" ? "danger" : "success"}
            />
            {!event.retryable ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("directory.errors.sourceRetry")}
              </p>
            ) : null}
            {canWrite && event.resolution === "open" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={acting}
                  onClick={() => {
                    onAction([event], "resolve");
                    onClose();
                  }}
                >
                  {t("directory.errors.resolve")}
                </Button>
                {event.retryable ? (
                  <Button
                    disabled={acting}
                    onClick={() => {
                      onAction([event], "retry");
                      onClose();
                    }}
                  >
                    <RefreshCwIcon />
                    {t("directory.errors.retry")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
