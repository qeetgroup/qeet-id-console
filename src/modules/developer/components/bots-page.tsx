import { BotIcon, WebhookIcon, ZapIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";

/**
 * Developer › Bots: the server has no automations yet, so the page is off the sidebar and says so
 * for an old link, pointing at what does the job today: webhooks and auth hooks.
 */
export function BotsPage() {
  const { t } = useTranslation("developer");
  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("bots.title")}
        description={t("bots.description")}
      />
      <PageContent>
        <EmptyState
          icon={BotIcon}
          level={2}
          title={t("bots.empty.title")}
          description={t("bots.empty.description")}
          actions={
            <>
              <Button variant="soft" icon={WebhookIcon} render={<Link to="/developer/webhooks" />}>
                {t("bots.empty.webhooks")}
              </Button>
              <Button variant="ghost" icon={ZapIcon} render={<Link to="/developer/auth-hooks" />}>
                {t("bots.empty.authHooks")}
              </Button>
            </>
          }
        />
      </PageContent>
    </>
  );
}
