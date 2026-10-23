import { Card, CardContent, EmptyState } from "@qeetrix/ui";
import { ServerIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";

// A placeholder until platform-health telemetry exists: no metrics an operator might trust.
/** Renders the platform-health placeholder until its telemetry exists. */
export function InfrastructurePage() {
  const { t } = useTranslation("developer");
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("infrastructure.description")} />
      <Card>
        <CardContent className="py-16">
          <EmptyState
            icon={ServerIcon}
            title={t("infrastructure.comingSoon.title")}
            description={t("infrastructure.comingSoon.description")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
