import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandingSettingsPage } from "@/modules/branding/pages";
import { UnsavedChangesGuard } from "@/shared/components/unsaved-changes-guard";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/settings/branding")({
  staticData: { capability: "branding.write", pageHeader: true },
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
        title={t("leave.title")}
        description={t("leave.description")}
        stayLabel={t("leave.stay")}
        leaveLabel={t("leave.discard")}
      />
    </>
  );
}
