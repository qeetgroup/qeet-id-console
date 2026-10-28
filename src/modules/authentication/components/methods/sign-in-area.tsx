import { PageContent, PageHeader } from "@qeetrix/react/experimental";
import type { ReactNode } from "react";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import "./methods.css";

/**
 * A page with sub-pages in the navigation (Sign-in: Password, Passwordless, Passkeys, Magic links;
 * MFA: TOTP, SMS / email): the header with its breadcrumb and the sub-pages as tabs, then the
 * chosen one's sections at the settings width.
 */
export function MethodsArea({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={title}
        description={description}
        tabs={<PageTabList />}
      />
      <PageContent width="narrow">{children}</PageContent>
    </PageTabs>
  );
}
