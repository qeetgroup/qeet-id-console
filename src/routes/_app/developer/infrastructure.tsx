import { Card, CardContent, EmptyState } from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import { ServerIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";

export const Route = createFileRoute("/_app/developer/infrastructure")({
  component: InfrastructurePage,
});

// A placeholder until platform-health telemetry exists: no metrics an operator might trust.
function InfrastructurePage() {
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
