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

import { EmailTemplatesPage } from "@/modules/organizations/components/email-templates-page";

export const Route = createFileRoute("/_app/settings/organization/email-templates")({
  component: EmailTemplatesRoute,
});

/**
 * Renders the email template editor and, as the branding page does, asks to confirm before
 * navigating away from unsaved changes, which the editor would otherwise discard silently.
 */
function EmailTemplatesRoute() {
  const { t } = useTranslation("settings");
  const [changed, setChanged] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: () => changed,
    enableBeforeUnload: changed,
    withResolver: true,
  });

  return (
    <>
      <EmailTemplatesPage onDirtyChange={setChanged} />
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("emails.leave.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("emails.leave.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              {t("emails.leave.stay")}
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              {t("emails.leave.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
