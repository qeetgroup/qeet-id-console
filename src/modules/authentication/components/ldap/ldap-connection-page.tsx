import {
  CircleAlertIcon,
  EllipsisIcon,
  EyeIcon,
  FlaskConicalIcon,
  PencilIcon,
  PowerIcon,
  ServerIcon,
  TrashIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  IconButton,
  Link,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
} from "@qeetrix/react";
import { Alert, DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { type LdapConnection, useLdapConnections } from "@/modules/authentication/api/ldap";
import {
  connectionStatus,
  eventReason,
  hostOf,
  latestTest,
  ldapEncryption,
} from "@/modules/authentication/connections-model";
import {
  CheckList,
  DangerZone,
  Detail,
  Mono,
  Section,
  StatusBadge,
} from "@/modules/authentication/components/connections/connection-parts";
import { FeatureGate } from "@/modules/billing";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  DEFAULT_EVENT_FILTERS,
  type DirectoryEvent,
  useDirectoryEvents,
} from "@/modules/directory";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { LdapDrawer } from "./ldap-drawer";
import { LdapHowItWorks } from "./ldap-how-it-works";
import { SignInDays, testCheck } from "./ldap-activity";
import { useLdapActions } from "./use-ldap-actions";
import "@/modules/authentication/components/connections/connections.css";

const NO_EVENTS: DirectoryEvent[] = [];

/**
 * One LDAP or Active Directory connection, under Directories › Connections: what only it has.
 * How a sign-in goes through it, drawn with its own values; its server and TLS; the attributes
 * that become a person's email and name; its status and what each means; its latest test with
 * the reason; and its sign-ins over 30 days. The Connections list already says its kind, status,
 * health and last use.
 */
export function LdapConnectionPage({ id }: { id: string }) {
  const { t } = useTranslation("connections");
  const access = useCapabilities();
  const listQ = useLdapConnections();
  const connection = listQ.data?.items.find((c) => c.id === id);

  if (listQ.isError)
    return (
      <PageContent>
        <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
      </PageContent>
    );
  if (!listQ.data)
    return (
      <PageContent>
        <Skeleton lines={8} />
      </PageContent>
    );
  if (!connection)
    return (
      <>
        <PageHeader breadcrumb={<PageBreadcrumb />} title={t("ldap.notFound.title")} />
        <PageContent>
          <EmptyState
            icon={ServerIcon}
            title={t("ldap.notFound.title")}
            description={t("ldap.notFound.description")}
            actions={
              <Button
                variant="soft"
                tone="neutral"
                render={<RouterLink to="/directory/connections" />}
              >
                {t("ldap.notFound.back")}
              </Button>
            }
          />
        </PageContent>
      </>
    );
  return <LdapRecord connection={connection} canWrite={access.can("connection.write")} />;
}

function LdapRecord({
  connection: c,
  canWrite,
}: {
  connection: LdapConnection;
  canWrite: boolean;
}) {
  const { t } = useTranslation("connections");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((o) => o.id === tenantId)?.name ?? t("scim.yourOrg");
  const actions = useLdapActions();
  const [editing, setEditing] = useState(false);

  // Its tests over 90 days (the longest the server reads), and its sign-ins over 30.
  const testsQ = useDirectoryEvents({
    ...DEFAULT_EVENT_FILTERS,
    connection_id: c.id,
    days: 90,
    q: "test",
    limit: 5,
  });
  const signInsQ = useDirectoryEvents({
    ...DEFAULT_EVENT_FILTERS,
    connection_id: c.id,
    days: 30,
    q: "sign-in",
    limit: 100,
  });
  const now = testsQ.dataUpdatedAt || Date.now();
  const last = latestTest(testsQ.data?.items ?? NO_EVENTS);
  const outcome = actions.outcome;
  const failing =
    outcome?.state === "failed" ||
    (!outcome && last?.status === "failed" && c.status !== "disabled");
  const status = connectionStatus(c.status, failing);
  const ago = (iso: string) => formatRelativeTime(Date.parse(iso), locale, now);

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={c.name}
        status={<StatusBadge status={status} />}
        description={t("ldap.page.description", {
          date: formatDate(c.created_at, locale, { dateStyle: "medium" }),
          used: c.last_login_at ? ago(c.last_login_at) : t("ldap.page.neverUsed"),
        })}
        actions={
          canWrite ? (
            <>
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      icon={EllipsisIcon}
                      aria-label={t("parts.moreActions")}
                      variant="ghost"
                      tone="neutral"
                    />
                  }
                />
                <MenuContent align="end">
                  <MenuItem icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("ldap.page.edit")}
                  </MenuItem>
                  {c.status === "active" ? (
                    <MenuItem icon={PowerIcon} onClick={() => void actions.setOn(c, false)}>
                      {t("ldap.off.button")}
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  <MenuItem icon={TrashIcon} tone="danger" onClick={() => void actions.remove(c)}>
                    {t("ldap.delete.button")}
                  </MenuItem>
                </MenuContent>
              </Menu>
              <Button
                variant="soft"
                tone="neutral"
                icon={FlaskConicalIcon}
                loading={outcome?.state === "running"}
                onClick={() => void actions.test(c)}
              >
                {t("ldap.test.button")}
              </Button>
              {c.status !== "active" ? (
                <Button
                  icon={PowerIcon}
                  loading={actions.pending}
                  onClick={() => void actions.setOn(c, true)}
                >
                  {t("ldap.on.button")}
                </Button>
              ) : null}
            </>
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
          <div className="cx-detail">
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
            {failing ? (
              <Alert
                className="cx-alert"
                tone="danger"
                icon={CircleAlertIcon}
                title={t("ldap.failing.title", { host: hostOf(c.server_url) })}
                actions={
                  canWrite ? (
                    <Button
                      variant="soft"
                      tone="neutral"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      {t("ldap.page.edit")}
                    </Button>
                  ) : undefined
                }
              >
                {outcome?.state === "failed"
                  ? t(`ldap.test.failed.${outcome.reason}`)
                  : last
                    ? t("ldap.failing.description", {
                        reason: eventReason(last),
                        when: ago(last.started_at),
                      })
                    : null}
              </Alert>
            ) : null}

            <Section
              id="ldap-how"
              title={t("ldap.how.title")}
              description={t("ldap.how.note")}
              action={
                canWrite ? (
                  <Button variant="ghost" icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("ldap.page.edit")}
                  </Button>
                ) : undefined
              }
            >
              <LdapHowItWorks connection={c} org={org} />
            </Section>

            <Section
              id="ldap-server"
              title={t("ldap.server.title")}
              description={t("ldap.server.note")}
            >
              <dl className="account-details">
                <Detail label={t("ldap.server.url")}>
                  <Mono>{c.server_url}</Mono>
                </Detail>
                <Detail
                  label={t("ldap.server.encryption")}
                  hint={t(`ldap.server.encryptionHint.${ldapEncryption(c)}`)}
                >
                  <span className="cx-inline">
                    {t(`ldap.server.encryptionWord.${ldapEncryption(c)}`)}
                    {ldapEncryption(c) === "none" ? (
                      <Badge tone="warning" size="sm">
                        {t("ldap.server.unencrypted")}
                      </Badge>
                    ) : null}
                  </span>
                </Detail>
                <Detail
                  label={t("ldap.server.certificate")}
                  hint={c.skip_tls_verify ? t("ldap.server.skipHint") : t("ldap.server.verifyHint")}
                >
                  {c.skip_tls_verify ? (
                    <span className="cx-inline">
                      {t("ldap.server.notChecked")}
                      <Badge tone="warning" size="sm">
                        {t("ldap.server.devOnly")}
                      </Badge>
                    </span>
                  ) : (
                    t("ldap.server.checked")
                  )}
                </Detail>
              </dl>
            </Section>

            <Section
              id="ldap-attributes"
              title={t("ldap.attributes.title")}
              description={t("ldap.attributes.note")}
              action={
                <Button variant="ghost" render={<RouterLink to="/directory/attribute-mappings" />}>
                  {t("ldap.attributes.mappings")}
                </Button>
              }
            >
              <dl className="account-details">
                <Detail label={t("ldap.attributes.email")} hint={t("ldap.attributes.emailHint")}>
                  <Mono>{c.email_attribute}</Mono>
                </Detail>
                <Detail label={t("ldap.attributes.name")} hint={t("ldap.attributes.nameHint")}>
                  <Mono>{c.name_attribute}</Mono>
                </Detail>
                <Detail label={t("ldap.attributes.newPeople")}>
                  {t("ldap.attributes.newPeopleText", { org })}
                </Detail>
              </dl>
            </Section>

            <Section
              id="ldap-status"
              title={t("ldap.status.title")}
              description={t("ldap.status.note")}
            >
              <ol className="cx-states">
                {(["draft", "active", "disabled"] as const).map((s) => (
                  <li
                    key={s}
                    className="cx-state"
                    aria-current={c.status === s ? "true" : undefined}
                  >
                    <strong>{t(`ldap.status.word.${s}`)}</strong>
                    <span>{t(`ldap.status.means.${s}`)}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="ldap-test" title={t("ldap.test.title")} description={t("ldap.test.note")}>
              <CheckList
                checks={[testCheck(t, c, outcome, last, ago)]}
                footer={
                  <>
                    <span>
                      {testsQ.data
                        ? t("ldap.test.recorded", {
                            count: testsQ.data.total,
                            n: n(testsQ.data.total),
                          })
                        : null}{" "}
                      <Link render={<RouterLink to="/directory/sync-activity" />}>
                        {t("ldap.test.activity")}
                      </Link>
                    </span>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        icon={FlaskConicalIcon}
                        loading={outcome?.state === "running"}
                        onClick={() => void actions.test(c)}
                      >
                        {last || outcome ? t("ldap.test.again") : t("ldap.test.button")}
                      </Button>
                    ) : null}
                  </>
                }
              />
            </Section>

            <Section
              id="ldap-sign-ins"
              title={t("ldap.signIns.title")}
              description={
                c.last_login_at
                  ? t("ldap.signIns.last", {
                      when: ago(c.last_login_at),
                      date: formatDateTime(c.last_login_at, locale),
                    })
                  : t("ldap.signIns.none")
              }
            >
              <SignInDays events={signInsQ.data?.items ?? NO_EVENTS} now={now} />
            </Section>

            {canWrite ? (
              <DangerZone
                title={t("ldap.delete.zoneTitle")}
                description={
                  c.status === "active" ? t("ldap.delete.zoneOn") : t("ldap.delete.zoneOff")
                }
              >
                <Button tone="danger" icon={TrashIcon} onClick={() => void actions.remove(c)}>
                  {t("ldap.delete.confirm")}
                </Button>
              </DangerZone>
            ) : null}
          </div>
        </FeatureGate>
      </PageContent>
      <LdapDrawer open={editing} onOpenChange={setEditing} connection={c} />
    </>
  );
}
