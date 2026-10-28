import {
  AppWindowIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
} from "@qeetrix/icons";
import {
  Button,
  formatDate,
  formatNumber,
  formatRelativeTime,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
} from "@qeetrix/react";
import { Alert, DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import {
  idpEntityId,
  idpMetadataUrl,
  idpSignInUrl,
  idpSsoUrl,
  type SamlProvider,
  useDeleteSamlProvider,
  useSamlProviders,
  useUpdateSamlProvider,
} from "@/modules/authentication/api/saml-idp";
import { connectionStatus, hostOf } from "@/modules/authentication/connections-model";
import {
  CopyRow,
  Detail,
  Section,
  SetupLayout,
  StatusBadge,
} from "@/modules/authentication/components/connections/connection-parts";
import { FeatureGate } from "@/modules/billing";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { nameIdFormat, SamlAppDrawer } from "./saml-app-drawer";
import "@/modules/authentication/components/connections/connections.css";

/**
 * SSO › SAML IdP: the apps Qeet ID signs people in to. Qeet ID's details are the same for every
 * app (its metadata, entity ID and sign-in URL); then each app, its status and last sign-in, with
 * a test sign-in that starts at Qeet ID, Edit, turning it off and removing it.
 */
export type SamlAppsPageProps = {
  /** Add app asked for (`?action=create`). */
  adding: boolean;
  onAddingChange: (open: boolean) => void;
};

export function SamlAppsPage({ adding, onAddingChange }: SamlAppsPageProps) {
  const { t } = useTranslation("saml");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const canWrite = useCapabilities().can("connection.write");
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((o) => o.id === tenantId)?.name ?? t("signIn.yourOrg");
  const listQ = useSamlProviders();
  const [editing, setEditing] = useState<SamlProvider | null>(null);

  const apps = listQ.data?.items ?? [];
  const on = apps.filter((a) => a.status === "active").length;
  const setup = apps.filter((a) => a.status === "draft").length;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("apps.title")}
        count={listQ.data ? apps.length : undefined}
        description={
          listQ.data && apps.length
            ? t("apps.descriptionCounts", { org, on: n(on), setup: n(setup) })
            : t("apps.description", { org })
        }
        actions={
          canWrite ? (
            <Button icon={PlusIcon} onClick={() => onAddingChange(true)}>
              {t("apps.add")}
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
          ) : !listQ.data || !tenantId ? (
            <Skeleton lines={8} />
          ) : (
            <SetupLayout
              label={t("apps.steps.label")}
              current={!apps.length ? 1 : setup ? 2 : 3}
              steps={[
                { label: t("apps.steps.ours"), description: t("apps.steps.oursNote") },
                {
                  label: t("apps.steps.add"),
                  description: t("apps.steps.addNote", { count: apps.length, n: n(apps.length) }),
                },
                {
                  label: t("apps.steps.turnOn"),
                  description: setup
                    ? t("apps.steps.turnOnSetup", { count: setup, n: n(setup) })
                    : t("apps.steps.turnOnDone"),
                },
              ]}
            >
              {!canWrite ? (
                <Alert
                  className="cx-alert"
                  tone="info"
                  icon={EyeIcon}
                  title={t("signIn.readOnly.title")}
                >
                  {t("signIn.readOnly.description")}
                </Alert>
              ) : null}
              <Section id="saml-idp" title={t("apps.ours.title")} description={t("apps.ours.note")}>
                <dl className="account-details">
                  <CopyRow
                    label={t("apps.ours.metadata")}
                    value={idpMetadataUrl(tenantId)}
                    hint={t("apps.ours.metadataHint")}
                    copyLabel={t("apps.ours.copyMetadata")}
                  />
                  <CopyRow
                    label={t("apps.ours.entity")}
                    value={idpEntityId(tenantId)}
                    hint={t("apps.ours.entityHint")}
                    copyLabel={t("apps.ours.copyEntity")}
                  />
                  <CopyRow
                    label={t("apps.ours.sso")}
                    value={idpSsoUrl(tenantId)}
                    hint={t("apps.ours.ssoHint")}
                    copyLabel={t("apps.ours.copySso")}
                  />
                  <Detail label={t("apps.ours.nameId")} hint={t("apps.ours.nameIdHint")}>
                    {t("apps.ours.nameIdValue")}
                  </Detail>
                </dl>
              </Section>

              <Section
                id="saml-apps"
                title={t("apps.list.title")}
                description={t("apps.list.note", { org })}
              >
                {apps.length ? (
                  <ul className="account-rows">
                    {apps.map((app) => (
                      <AppRow
                        key={app.id}
                        app={app}
                        tenantId={tenantId}
                        canWrite={canWrite}
                        onEdit={() => setEditing(app)}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="cx-empty">
                    <EmptyState
                      size="section"
                      icon={AppWindowIcon}
                      title={t("apps.list.emptyTitle")}
                      description={t("apps.list.emptyDescription")}
                      actions={
                        canWrite ? (
                          <Button
                            variant="soft"
                            tone="neutral"
                            icon={PlusIcon}
                            onClick={() => onAddingChange(true)}
                          >
                            {t("apps.add")}
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                )}
              </Section>
            </SetupLayout>
          )}
        </FeatureGate>
      </PageContent>
      <SamlAppDrawer open={adding} onOpenChange={onAddingChange} />
      <SamlAppDrawer
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        app={editing ?? undefined}
      />
    </>
  );
}

/** One app: its status, where it takes sign-ins and when someone last signed in, its actions. */
function AppRow({
  app,
  tenantId,
  canWrite,
  onEdit,
}: {
  app: SamlProvider;
  tenantId: string;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation("saml");
  const locale = formatLocale();
  const runSensitive = useSensitiveAction();
  const updateM = useUpdateSamlProvider();
  const deleteM = useDeleteSamlProvider();
  const format = nameIdFormat(app.name_id_format);
  const line = [
    hostOf(app.acs_url),
    app.last_login_at
      ? t("apps.list.lastSignIn", {
          when: formatRelativeTime(Date.parse(app.last_login_at), locale, Date.now()),
        })
      : t("apps.list.added", { date: formatDate(app.created_at, locale, { dateStyle: "medium" }) }),
    format === "email"
      ? null
      : t("apps.list.format", {
          format: format ? t(`appDrawer.formats.${format}`) : app.name_id_format,
        }),
  ]
    .filter(Boolean)
    .join(" · ");

  const setOn = (on: boolean) =>
    runSensitive({
      capability: "connection.write",
      confirm: on
        ? undefined
        : {
            title: t("apps.off.title", { name: app.name }),
            description: t("apps.off.description", { name: app.name }),
            confirmLabel: t("apps.off.confirm"),
            tone: "default",
          },
      actionLabel: on ? t("apps.on.action") : t("apps.off.action"),
      run: () =>
        updateM
          .mutateAsync({ id: app.id, status: on ? "active" : "disabled" })
          .then(() =>
            toast.success(
              on ? t("apps.on.done", { name: app.name }) : t("apps.off.done", { name: app.name }),
            ),
          ),
    }).catch(settleSensitiveAction);
  const remove = () =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("apps.remove.title", { name: app.name }),
        description: t("apps.remove.description", { name: app.name }),
        confirmLabel: t("apps.remove.confirm"),
        tone: "destructive",
      },
      actionLabel: t("apps.remove.action"),
      run: () => deleteM.mutateAsync(app.id),
    }).catch(settleSensitiveAction);

  return (
    <li className="account-row">
      <span className="account-icon" aria-hidden="true">
        <AppWindowIcon />
      </span>
      <span className="account-row-text">
        <span className="account-row-name">
          <strong>{app.name}</strong>
          <StatusBadge status={connectionStatus(app.status)} size="sm" />
        </span>
        <small>{line}</small>
      </span>
      <span className="account-row-actions">
        {app.status !== "disabled" ? (
          <Button
            variant="ghost"
            icon={ExternalLinkIcon}
            render={<a href={idpSignInUrl(tenantId, app.id)} target="_blank" rel="noreferrer" />}
          >
            {t("apps.list.test")}
          </Button>
        ) : null}
        {canWrite ? (
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  icon={EllipsisIcon}
                  aria-label={t("apps.list.more", { name: app.name })}
                  variant="ghost"
                  tone="neutral"
                />
              }
            />
            <MenuContent align="end">
              <MenuItem icon={PencilIcon} onClick={onEdit}>
                {t("apps.list.edit")}
              </MenuItem>
              <MenuItem icon={PowerIcon} onClick={() => void setOn(app.status !== "active")}>
                {app.status === "active" ? t("apps.off.button") : t("apps.on.button")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={TrashIcon} tone="danger" onClick={() => void remove()}>
                {t("apps.remove.button")}
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
      </span>
    </li>
  );
}
