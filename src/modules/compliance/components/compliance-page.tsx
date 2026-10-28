// Security › Compliance: one page whose views (SOC 2, ISO 27001, GDPR, Retention) are its tabs,
// each its own route. Every view draws this header and its own body under it.

import { PageContent, PageHeader } from "@qeetrix/react/experimental";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import "./compliance.css";

export function CompliancePage({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation("compliance");
  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("page.title")}
        description={t("page.description")}
        actions={actions}
        tabs={<PageTabList />}
      />
      <PageContent>
        <div className="cmp">{children}</div>
      </PageContent>
    </PageTabs>
  );
}
