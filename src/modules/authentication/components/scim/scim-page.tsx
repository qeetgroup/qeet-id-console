import { EyeIcon, KeyRoundIcon, PowerIcon, RefreshCwIcon, UsersIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  Skeleton,
  Table,
  Text,
} from "@qeetrix/react";
import { Alert, DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useAdminPortalLinks } from "@/modules/authentication/api/admin-portal";
import {
  type ScimProvisionedUser,
  scimBaseUrl,
  useScimConfig,
  useScimProvisionedUsers,
} from "@/modules/authentication/api/scim";
import { useRevokeScimToken, useRotateScimToken } from "@/modules/authentication/api/scim-actions";
import { scimStatus, setupLinkState } from "@/modules/authentication/connections-model";
import {
  CopyRow,
  DangerZone,
  Detail,
  Mono,
  None,
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
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import "@/modules/authentication/components/connections/connections.css";

/** The server lists at most this many of the people SCIM provisioned. */
const LISTED = 200;

/**
 * Directories › Connections › SCIM provisioning: what only SCIM has. How provisioning works, with
 * its real values; what to paste into the identity provider; the token (set, made, last used),
 * made or replaced once on this page and shown once; what each change the identity provider
 * sends does to people here (the server's rules); and the people it provisioned. The Connections
 * list already says its kind, people, status, health and last use.
 */
export function ScimPage() {
  const { t } = useTranslation("connections");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const access = useCapabilities();
  const canWrite = access.can("connection.write");
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((o) => o.id === tenantId)?.name;
  const runSensitive = useSensitiveAction();

  const configQ = useScimConfig();
  const usersQ = useScimProvisionedUsers();
  const linksQ = useAdminPortalLinks();
  const rotateM = useRotateScimToken();
  const revokeM = useRevokeScimToken();
  const [fresh, setFresh] = useState<string | null>(null);

  const config = configQ.data;
  const set = !!config?.token_set;
  const people = config?.provisioned_count ?? 0;
  const now = configQ.dataUpdatedAt || Date.now();
  const orgName = org ?? t("scim.yourOrg");
  const links = (linksQ.data?.items ?? []).filter(
    (l) => l.capabilities.includes("scim") && setupLinkState(l, now) === "active",
  );
  const current = !set ? 0 : config?.last_used_at ? 3 : 1;

  // A first token replaces nothing; replacing one stops the identity provider's at once, so it
  // asks first. Either way the server asks the person to confirm it's them.
  const makeToken = () =>
    runSensitive({
      capability: "connection.write",
      confirm: set
        ? {
            title: t("scim.replace.title"),
            description: t("scim.replace.description"),
            confirmLabel: t("scim.replace.confirm"),
            tone: "destructive",
          }
        : undefined,
      actionLabel: set ? t("scim.replace.action") : t("scim.make.action"),
      run: () => rotateM.mutateAsync(),
    })
      .then((res) => {
        if (res) setFresh(res.token);
      })
      .catch(settleSensitiveAction);

  const revoke = () =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("scim.revoke.title"),
        description: t("scim.revoke.description", { count: people, n: n(people) }),
        confirmLabel: t("scim.revoke.confirm"),
        tone: "destructive",
      },
      actionLabel: t("scim.revoke.action"),
      run: () => revokeM.mutateAsync(),
    })
      .then(() => setFresh(null))
      .catch(settleSensitiveAction);

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("scim.title")}
        status={config ? <StatusBadge status={scimStatus(config)} /> : undefined}
        description={t("scim.description", { org: orgName })}
        actions={
          canWrite && config && !set ? (
            <Button icon={PowerIcon} loading={rotateM.isPending} onClick={() => void makeToken()}>
              {t("scim.make.button")}
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
          feature="scim"
          title={t("scim.gate.title")}
          description={t("scim.gate.description")}
        >
          {configQ.isError ? (
            <DataState error={configQ.error} onRetry={() => configQ.refetch()} />
          ) : !config ? (
            <Skeleton lines={8} />
          ) : (
            <SetupLayout
              label={t("scim.steps.label")}
              current={current}
              steps={[
                {
                  label: t("scim.steps.token"),
                  description: set
                    ? t("scim.steps.tokenMade", {
                        date: formatDate(config.created_at ?? now, locale, { dateStyle: "medium" }),
                      })
                    : t("scim.steps.tokenTodo"),
                },
                { label: t("scim.steps.details"), description: t("scim.steps.detailsNote") },
                {
                  label: t("scim.steps.first"),
                  description: config.last_used_at
                    ? t("scim.steps.firstDone", {
                        when: formatRelativeTime(Date.parse(config.last_used_at), locale, now),
                      })
                    : t("scim.steps.firstTodo"),
                },
              ]}
            >
              {!canWrite ? (
                <Alert
                  className="cx-alert"
                  tone="info"
                  icon={EyeIcon}
                  title={t("parts.readOnly.title")}
                >
                  {t("parts.readOnly.description")}
                </Alert>
              ) : null}

              <Section id="scim-how" title={t("scim.how.title")} description={t("scim.how.note")}>
                <ol className="cx-flow" style={{ "--cx-flow-steps": 3 } as CSSProperties}>
                  <li className="cx-flow-step">
                    <p className="cx-flow-cap">{t("scim.how.idp")}</p>
                    {set ? (
                      <p className="cx-flow-value">{`${config.token_prefix ?? "qf_scim_"}••••••••`}</p>
                    ) : (
                      <p className="cx-flow-value is-text">{t("scim.how.noToken")}</p>
                    )}
                    <p className="cx-flow-note">{t("scim.how.idpNote")}</p>
                  </li>
                  <li className="cx-flow-step">
                    <p className="cx-flow-cap">{t("scim.how.endpoint")}</p>
                    <p className="cx-flow-value">{scimBaseUrl()}</p>
                    <p className="cx-flow-note">{t("scim.how.endpointNote")}</p>
                  </li>
                  <li className="cx-flow-step">
                    <p className="cx-flow-cap">{t("scim.how.here", { org: orgName })}</p>
                    <p className="cx-flow-value is-text">
                      {t("scim.how.people", { count: people, n: n(people) })}
                    </p>
                    <p className="cx-flow-note">{t("scim.how.hereNote", { org: orgName })}</p>
                  </li>
                </ol>
              </Section>

              <Section
                id="scim-details"
                title={t("scim.details.title")}
                description={t("scim.details.note")}
              >
                <dl className="account-details">
                  <CopyRow
                    label={t("scim.details.baseUrl")}
                    value={scimBaseUrl()}
                    hint={t("scim.details.baseUrlHint")}
                    copyLabel={t("scim.details.copyBaseUrl")}
                  />
                  <Detail label={t("scim.details.userName")} hint={t("scim.details.userNameHint")}>
                    <Mono>userName</Mono>
                  </Detail>
                </dl>
              </Section>

              <Section
                id="scim-token"
                title={t("scim.token.title")}
                description={t("scim.token.note")}
                action={
                  canWrite && set ? (
                    <Button
                      variant="ghost"
                      icon={RefreshCwIcon}
                      loading={rotateM.isPending}
                      onClick={() => void makeToken()}
                    >
                      {t("scim.replace.button")}
                    </Button>
                  ) : undefined
                }
              >
                {fresh ? (
                  <OneTimeSecret
                    title={t("scim.fresh.title")}
                    description={t("scim.fresh.description")}
                    values={[{ value: fresh }]}
                    dismissLabel={t("scim.fresh.done")}
                    onDismiss={() => {
                      setFresh(null);
                      rotateM.reset();
                    }}
                  />
                ) : null}
                <dl className="account-details">
                  <Detail
                    label={t("scim.token.state")}
                    hint={set ? t("scim.token.setHint") : t("scim.token.notSetHint")}
                    action={
                      canWrite && !set ? (
                        <Button
                          variant="ghost"
                          icon={KeyRoundIcon}
                          loading={rotateM.isPending}
                          onClick={() => void makeToken()}
                        >
                          {t("scim.make.short")}
                        </Button>
                      ) : undefined
                    }
                  >
                    {set ? (
                      <span className="cx-inline">
                        <Mono>{`${config.token_prefix ?? "qf_scim_"}••••••••`}</Mono>
                      </span>
                    ) : (
                      <None>{t("scim.token.notSet")}</None>
                    )}
                  </Detail>
                  {set && config.created_at ? (
                    <Detail label={t("scim.token.made")}>
                      <time
                        dateTime={config.created_at}
                        title={formatDateTime(config.created_at, locale)}
                      >
                        {formatDate(config.created_at, locale, { dateStyle: "long" })}
                      </time>
                    </Detail>
                  ) : null}
                  {set ? (
                    <Detail label={t("scim.token.used")} hint={t("scim.token.usedHint")}>
                      {config.last_used_at ? (
                        <time
                          dateTime={config.last_used_at}
                          title={formatDateTime(config.last_used_at, locale)}
                        >
                          {formatRelativeTime(Date.parse(config.last_used_at), locale, now)}
                        </time>
                      ) : (
                        <None>{t("scim.token.never")}</None>
                      )}
                    </Detail>
                  ) : null}
                  <Detail
                    label={t("scim.token.links")}
                    hint={t("scim.token.linksHint")}
                    action={
                      <Button
                        variant="ghost"
                        render={<RouterLink to="/auth/connections" hash="setup-links" />}
                      >
                        {t("scim.token.linksOpen")}
                      </Button>
                    }
                  >
                    {linksQ.data ? (
                      links.length ? (
                        t("scim.token.linksActive", { count: links.length, n: n(links.length) })
                      ) : (
                        <None>{t("scim.token.linksNone")}</None>
                      )
                    ) : (
                      <None>—</None>
                    )}
                  </Detail>
                </dl>
              </Section>

              <Section
                id="scim-changes"
                title={t("scim.changes.title")}
                description={t("scim.changes.note")}
              >
                <dl className="account-details">
                  <Detail label={t("scim.changes.added")}>
                    {t("scim.changes.addedText", { org: orgName })}
                  </Detail>
                  <Detail
                    label={t("scim.changes.deactivated")}
                    hint={t("scim.changes.deactivatedHint")}
                  >
                    {t("scim.changes.deactivatedText")}
                  </Detail>
                  <Detail label={t("scim.changes.removed")}>{t("scim.changes.removedText")}</Detail>
                  <Detail label={t("scim.changes.groups")}>{t("scim.changes.groupsText")}</Detail>
                  <Detail label={t("scim.changes.owners")}>
                    {t("scim.changes.ownersText", { org: orgName })}
                  </Detail>
                </dl>
              </Section>

              <Section
                id="scim-people"
                title={t("scim.people.title")}
                status={
                  people ? (
                    <Badge size="sm" tone="neutral">
                      {n(people)}
                    </Badge>
                  ) : undefined
                }
                description={
                  people > LISTED
                    ? t("scim.people.latest", { n: n(LISTED) })
                    : t("scim.people.note")
                }
              >
                <ProvisionedPeople
                  rows={usersQ.data?.items ?? []}
                  loading={usersQ.isLoading}
                  error={usersQ.isError ? usersQ.error : undefined}
                  onRetry={() => void usersQ.refetch()}
                />
              </Section>

              {canWrite && set ? (
                <DangerZone
                  title={t("scim.revoke.zoneTitle")}
                  description={t("scim.revoke.zoneNote")}
                >
                  <Button
                    tone="danger"
                    icon={KeyRoundIcon}
                    loading={revokeM.isPending}
                    onClick={revoke}
                  >
                    {t("scim.revoke.button")}
                  </Button>
                </DangerZone>
              ) : null}
            </SetupLayout>
          )}
        </FeatureGate>
      </PageContent>
    </>
  );
}

/** The people SCIM made or adopted: who, their state here, the identity provider's ID, when. */
function ProvisionedPeople({
  rows,
  loading,
  error,
  onRetry,
}: {
  rows: ScimProvisionedUser[];
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation("connections");
  const locale = formatLocale();
  if (error) return <DataState error={error} onRetry={onRetry} />;
  return (
    <Table<ScimProvisionedUser>
      label={t("scim.people.title")}
      rows={rows}
      rowId={(u) => u.id}
      rowLabel={(u) => u.display_name || u.email}
      loading={loading}
      renderRowLink={(u) => <RouterLink to="/users/$userId" params={{ userId: u.id }} />}
      columns={[
        {
          id: "person",
          header: t("scim.people.person"),
          primary: true,
          cell: (u) => (
            <span className="cx-name">
              <strong>{u.display_name || u.email}</strong>
              {u.display_name ? <small>{u.email}</small> : null}
            </span>
          ),
        },
        {
          id: "status",
          header: t("scim.people.status"),
          width: 120,
          cell: (u) =>
            u.status === "active" ? (
              <Badge tone="success" size="sm">
                {t("scim.people.active")}
              </Badge>
            ) : u.status === "suspended" ? (
              <Badge tone="warning" size="sm">
                {t("scim.people.suspended")}
              </Badge>
            ) : (
              <Badge size="sm">{u.status}</Badge>
            ),
        },
        {
          id: "external",
          header: t("scim.people.externalId"),
          cell: (u) =>
            u.external_id ? (
              <Text mono size="sm" tone="subtle" truncate>
                {u.external_id}
              </Text>
            ) : (
              <Text tone="subtle">—</Text>
            ),
        },
        {
          id: "added",
          header: t("scim.people.added"),
          width: 130,
          numeric: true,
          cell: (u) => (
            <time dateTime={u.created_at} title={formatDateTime(u.created_at, locale)}>
              {formatDate(u.created_at, locale, { dateStyle: "medium" })}
            </time>
          ),
        },
      ]}
      empty={
        <EmptyState
          size="section"
          icon={UsersIcon}
          title={t("scim.people.emptyTitle")}
          description={t("scim.people.emptyDescription")}
        />
      }
    />
  );
}
