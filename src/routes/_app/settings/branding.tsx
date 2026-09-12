import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@qeetrix/ui";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandingSettingsPage } from "@/modules/branding/components/branding-settings-page";

export const Route = createFileRoute("/_app/settings/branding")({ component: BrandingPage });

function BrandingPage() {
  const { t } = useTranslation("settings");
  const [changed, setChanged] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: () => changed,
    enableBeforeUnload: changed,
    withResolver: true,
  });

  return (
    <>
      <BrandingSettingsPage onDirtyChange={setChanged} />
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("branding.workspace.leave.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("branding.workspace.leave.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              {t("branding.workspace.leave.stay")}
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              {t("branding.workspace.leave.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
