import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandingSettingsPage } from "@/modules/branding/pages";
import { UnsavedChangesGuard } from "@/shared/components/unsaved-changes-guard";

export const Route = createFileRoute("/_app/settings/branding")({
  staticData: { capability: "branding.write" },
  component: BrandingPage,
});

function BrandingPage() {
  const { t } = useTranslation("branding");
  const [changed, setChanged] = useState(false);
  return (
    <>
      <BrandingSettingsPage onDirtyChange={setChanged} />
      <UnsavedChangesGuard
        when={changed}
        title={t("branding.workspace.leave.title")}
        description={t("branding.workspace.leave.description")}
        stayLabel={t("branding.workspace.leave.stay")}
        leaveLabel={t("branding.workspace.leave.discard")}
      />
    </>
  );
}
