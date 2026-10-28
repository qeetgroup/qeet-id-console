import { PlusIcon, ServerIcon } from "@qeetrix/icons";
import { Button, Skeleton } from "@qeetrix/react";
import { DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useLdapConnections } from "@/modules/authentication/api/ldap";
import { Section } from "@/modules/authentication/components/connections/connection-parts";
import { FeatureGate } from "@/modules/billing";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import { LdapDrawer } from "./ldap-drawer";
import "@/modules/authentication/components/connections/connections.css";

export type LdapIndexPageProps = {
  /** "New connection" asked for (`?action=create`): the drawer opens, and nothing redirects. */
  creating: boolean;
  onCreatingChange: (open: boolean) => void;
};

/**
 * /directory/connections/ldap: where "LDAP or Active Directory" leads. Each connection has its own
 * page (`/ldap/$id`), and Directories › Connections lists them all, so this opens the one there is,
 * sends several to the list, and with none says what a directory connection does and connects one.
 */
export function LdapIndexPage({ creating, onCreatingChange }: LdapIndexPageProps) {
  const { t } = useTranslation("connections");
  const canWrite = useCapabilities().can("connection.write");
  const listQ = useLdapConnections();
  const items = listQ.data?.items ?? [];

  if (!creating && items.length === 1 && items[0])
    return <Navigate to="/directory/connections/ldap/$id" params={{ id: items[0].id }} replace />;
  if (!creating && items.length > 1) return <Navigate to="/directory/connections" replace />;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("ldap.index.title")}
        description={t("ldap.index.description")}
        actions={
          canWrite ? (
            <Button icon={PlusIcon} onClick={() => onCreatingChange(true)}>
              {t("ldap.index.connect")}
            </Button>
          ) : undefined
        }
        tabs={
          <PageTabs>
            <PageTabList />
          </PageTabs>
        }
      />
      <PageContent>
        <FeatureGate
          feature="ldap"
          title={t("ldap.gate.title")}
          description={t("ldap.gate.description")}
        >
          {listQ.isError ? (
            <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
          ) : !listQ.data ? (
            <Skeleton lines={6} />
          ) : (
            <div className="cx-detail">
              <Section
                id="ldap-what"
                title={t("ldap.index.whatTitle")}
                description={t("ldap.index.whatNote")}
              >
                <ol className="cx-flow">
                  {(["bind", "find", "check", "signIn"] as const).map((step) => (
                    <li key={step} className="cx-flow-step">
                      <p className="cx-flow-cap">{t(`ldap.how.${step}`)}</p>
                      <p className="cx-flow-note">{t(`ldap.index.steps.${step}`)}</p>
                    </li>
                  ))}
                </ol>
              </Section>
              {items.length === 0 ? (
                <div className="cx-empty">
                  <EmptyState
                    size="section"
                    icon={ServerIcon}
                    title={t("ldap.index.emptyTitle")}
                    description={t("ldap.index.emptyDescription")}
                    actions={
                      canWrite ? (
                        <Button
                          variant="soft"
                          tone="neutral"
                          icon={PlusIcon}
                          onClick={() => onCreatingChange(true)}
                        >
                          {t("ldap.index.connect")}
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          )}
        </FeatureGate>
      </PageContent>
      <LdapDrawer open={creating} onOpenChange={onCreatingChange} />
    </>
  );
}
