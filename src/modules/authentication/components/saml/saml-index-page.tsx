import { PlusIcon, WorkflowIcon } from "@qeetrix/icons";
import { Button, Skeleton } from "@qeetrix/react";
import { DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Navigate } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useSamlConnections } from "@/modules/authentication/api/saml";
import { Section } from "@/modules/authentication/components/connections/connection-parts";
import { FeatureGate } from "@/modules/billing";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import { SamlDrawer } from "./saml-drawer";
import "@/modules/authentication/components/connections/connections.css";

export type SamlIndexPageProps = {
  /** "New connection" asked for (`?action=create`): the drawer opens, and nothing redirects. */
  creating: boolean;
  onCreatingChange: (open: boolean) => void;
};

/**
 * SSO › SAML: where people sign in through an outside identity provider. Each connection has its
 * own setup page (`/saml/$id`) and Connections lists them all, so this opens the one there is,
 * sends several to the list, and with none says how SAML sign-in works and starts one.
 */
export function SamlIndexPage({ creating, onCreatingChange }: SamlIndexPageProps) {
  const { t } = useTranslation("saml");
  const canWrite = useCapabilities().can("connection.write");
  const listQ = useSamlConnections();
  const items = listQ.data?.items ?? [];

  if (!creating && items.length === 1 && items[0])
    return <Navigate to="/auth/connections/saml/$id" params={{ id: items[0].id }} replace />;
  if (!creating && items.length > 1)
    return <Navigate to="/auth/connections" search={{ type: "signin" }} replace />;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("signIn.index.title")}
        description={t("signIn.index.description")}
        actions={
          canWrite ? (
            <Button icon={PlusIcon} onClick={() => onCreatingChange(true)}>
              {t("signIn.index.new")}
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
          feature="sso"
          title={t("signIn.gate.title")}
          description={t("signIn.gate.description")}
        >
          {listQ.isError ? (
            <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
          ) : !listQ.data ? (
            <Skeleton lines={6} />
          ) : (
            <div className="cx-detail">
              <Section
                id="saml-how"
                title={t("signIn.index.howTitle")}
                description={t("signIn.index.howNote")}
              >
                <ol className="cx-flow" style={{ "--cx-flow-steps": 3 } as CSSProperties}>
                  {(["start", "provider", "back"] as const).map((step) => (
                    <li key={step} className="cx-flow-step">
                      <p className="cx-flow-cap">{t(`signIn.index.steps.${step}`)}</p>
                      <p className="cx-flow-note">{t(`signIn.index.steps.${step}Note`)}</p>
                    </li>
                  ))}
                </ol>
              </Section>
              {items.length === 0 ? (
                <div className="cx-empty">
                  <EmptyState
                    size="section"
                    icon={WorkflowIcon}
                    title={t("signIn.index.emptyTitle")}
                    description={t("signIn.index.emptyDescription")}
                    actions={
                      canWrite ? (
                        <Button
                          variant="soft"
                          tone="neutral"
                          icon={PlusIcon}
                          onClick={() => onCreatingChange(true)}
                        >
                          {t("signIn.index.new")}
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
      <SamlDrawer open={creating} onOpenChange={onCreatingChange} />
    </>
  );
}
