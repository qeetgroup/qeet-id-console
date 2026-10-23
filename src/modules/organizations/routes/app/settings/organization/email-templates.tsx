import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EmailTemplatesPage } from "@/modules/organizations/pages";
import { UnsavedChangesGuard } from "@/shared/components/unsaved-changes-guard";

export const Route = createFileRoute("/_app/settings/organization/email-templates")({
  staticData: { capability: "branding.write" },
  component: EmailTemplatesRoute,
});

/** Renders the email template editor, asking before navigating away from unsaved changes. */
function EmailTemplatesRoute() {
  const { t } = useTranslation("organizations");
  const [changed, setChanged] = useState(false);
  return (
    <>
      <EmailTemplatesPage onDirtyChange={setChanged} />
      <UnsavedChangesGuard
        when={changed}
        title={t("emails.leave.title")}
        description={t("emails.leave.description")}
        stayLabel={t("emails.leave.stay")}
        leaveLabel={t("emails.leave.discard")}
      />
    </>
  );
}
