import { Card, CardContent, EmptyState } from "@qeetrix/ui";
import { BotIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";

// A placeholder until the automations backend exists: no fake data and no dead controls.
/** Renders the automations placeholder until their backend exists. */
export function BotsPage() {
  const { t } = useTranslation("developer");
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("bots.description")} />
      <Card>
        <CardContent className="py-16">
          <EmptyState
            icon={BotIcon}
            title={t("bots.comingSoon.title")}
            description={t("bots.comingSoon.description")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
