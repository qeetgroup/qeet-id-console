import {
  EllipsisIcon,
  FileBracesIcon,
  KeyRoundIcon,
  LogOutIcon,
  PencilIcon,
  SendIcon,
  ShieldOffIcon,
  UserCheckIcon,
  UserRoundIcon,
  UserXIcon,
} from "@qeetrix/icons";
import {
  Avatar,
  Badge,
  Button,
  formatDate,
  formatRelativeTime,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Skeleton,
  Tab,
  Tabs,
  TabsList,
  TabsPanel,
} from "@qeetrix/react";
import { Alert, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link as RouterLink, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useRegisterContext } from "@/modules/qeetai";
import { useSignInHistory } from "@/modules/users/api/person";
import {
  type UserDetail,
  useSendPasswordReset,
  useUserAccess,
  useUserSecurity,
  useUserSessions,
} from "@/modules/users/api/user360";
import { useUser } from "@/modules/users/api/users";
import { EditUserSheet } from "@/modules/users/components/edit-user-sheet";
import { roleLabel } from "@/modules/users/components/people/people-table";
import { SetPasswordSheet } from "@/modules/users/components/set-password-sheet";
import { lastActive, personNames } from "@/modules/users/person-model";
import type { User360Tab } from "@/modules/users/tabs";
import { useUserActions } from "@/modules/users/use-user-actions";
import { parseUserAgent } from "@/modules/users/user-agent";
import { useTenantId, useUserId } from "@/platform/auth/session";
import { ApiError } from "@/platform/errors/api-error";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { PersonAccess } from "./person-access";
import { PersonActivity } from "./person-activity";
import { PersonOverview } from "./person-overview";
import { RawRecordDrawer } from "./person-raw";
import { PersonSecurity } from "./person-security";
import { PersonSessions } from "./person-sessions";
import "./person.css";

/** What the viewer may do to this person: the server's rules, so the page only offers what works. */
export interface Standing {
  canWrite: boolean; // user.write
  home: boolean; // their account belongs to this organisation; else another one manages it
  self: boolean; // the person is the viewer
  manage: boolean; // whole-account actions: status, password, two-step, sessions, deletion
}

/**
 * A person's page: their record. The header names them and carries the actions on the whole
 * account; its band says what they can do, whether a second step protects them, when they were
 * last active and since when they're here. The views: Overview (how they sign in, what they can
 * do and why, recent activity, their details), Access, Security, Sessions and Activity.
 */
export function UserDetailPage({
  userId,
  tab,
  onTabChange,
}: {
  userId: string;
  tab: User360Tab;
  onTabChange: (tab: User360Tab) => void;
}) {
  const { t } = useTranslation("users");
  const access = useCapabilities();
  const tenantId = useTenantId();
  const me = useUserId();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const userQ = useUser(userId);
  const user = userQ.data;

  // Tells Qeet AI which person is on screen.
  const context = useMemo(
    () => ({ selection: { kind: "user" as const, id: userId, label: user?.email } }),
    [userId, user?.email],
  );
  useRegisterContext(pathname, context);

  if (userQ.isLoading)
    return (
      <PageContent>
        <Skeleton lines={8} />
      </PageContent>
    );
  if (!user) {
    const missing = userQ.error instanceof ApiError && userQ.error.status === 404;
    // The page keeps its heading either way, so the person is never left on a page with none.
    return (
      <>
        <PageHeader
          breadcrumb={<PageBreadcrumb />}
          title={missing || !userQ.isError ? t("person.notFound.heading") : t("person.loadFailed")}
        />
        <PageContent>
          {missing || !userQ.isError ? (
            <EmptyState
              icon={UserRoundIcon}
              title={t("person.notFound.title")}
              description={t("person.notFound.description")}
              actions={
                <Button render={<RouterLink to="/users" />} variant="soft">
                  {t("person.notFound.back")}
                </Button>
              }
            />
          ) : (
            <Alert
              tone="danger"
              title={t("person.loadFailed")}
              actions={
                <Button size="sm" variant="soft" onClick={() => void userQ.refetch()}>
                  {t("person.tryAgain")}
                </Button>
              }
            >
              {errorMessage(userQ.error)}
            </Alert>
          )}
        </PageContent>
      </>
    );
  }

  const canWrite = access.can("user.write");
  const home = user.tenant_id === tenantId;
  const self = user.id === me;
  const standing: Standing = { canWrite, home, self, manage: canWrite && home && !self };
  return <Person user={user} standing={standing} tab={tab} onTabChange={onTabChange} />;
}

function Person({
  user,
  standing,
  tab,
  onTabChange,
}: {
  user: UserDetail;
  standing: Standing;
  tab: User360Tab;
  onTabChange: (tab: User360Tab) => void;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const access = useCapabilities();
  const navigate = useNavigate();
  const canAudit = access.can("audit.read");
  const { full, first } = personNames(user);

  const securityQ = useUserSecurity(user.id);
  const accessQ = useUserAccess(user.id);
  const sessionsQ = useUserSessions(user.id);
  const signInsQ = useSignInHistory(user.id, canAudit);
  const actions = useUserActions();
  const sendReset = useSendPasswordReset();
  const [editing, setEditing] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [raw, setRaw] = useState(false);

  const security = securityQ.data;
  const sessions = sessionsQ.data?.items ?? [];
  const latest = lastActive(sessions);
  const lastSignIn = signInsQ.data?.events[0];
  const roles = accessQ.data?.roles ?? [];
  const groups = accessQ.data?.groups ?? [];
  const suspended = user.status === "suspended";
  const now = sessionsQ.dataUpdatedAt || Date.now();
  const resettable = !!security && (security.mfa_enabled || security.recovery_codes_remaining > 0);
  const { manage } = standing;

  const factors = security
    ? [
        security.totp_enabled ? t("person.band.factors.app") : null,
        security.otp_factors ? t("person.band.factors.codes") : null,
        security.push_devices ? t("person.band.factors.phone") : null,
      ].filter((f): f is string => !!f)
    : [];

  return (
    <Tabs value={tab} onValueChange={(next) => onTabChange(next as User360Tab)}>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={
          // The avatar sits in the title, unannounced, until PageHeader has a leading slot (QTRX-48).
          <span className="prs-title-name">
            <Avatar name={full} src={user.avatar_url ?? undefined} size="lg" decorative />
            {full}
          </span>
        }
        status={
          suspended ? (
            <Badge tone="warning">{t("status.suspended")}</Badge>
          ) : user.status === "invited" ? (
            <Badge tone="info">{t("status.invited")}</Badge>
          ) : (
            <Badge tone="success">{t("status.active")}</Badge>
          )
        }
        description={[
          user.email,
          [user.metadata?.title, user.metadata?.team]
            .filter((v): v is string => typeof v === "string" && !!v.trim())
            .join(", "),
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Menu>
              <MenuTrigger
                render={
                  <IconButton
                    icon={EllipsisIcon}
                    aria-label={t("person.header.more", { name: full })}
                    variant="ghost"
                    tone="neutral"
                  />
                }
              />
              <MenuContent align="end">
                {standing.canWrite && standing.home ? (
                  <MenuItem icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("person.header.edit")}
                  </MenuItem>
                ) : null}
                {manage ? (
                  <>
                    <MenuItem icon={KeyRoundIcon} onClick={() => setSettingPassword(true)}>
                      {t("person.header.setPassword")}
                    </MenuItem>
                    <MenuItem icon={SendIcon} onClick={() => sendReset.mutate(user.email)}>
                      {t("person.header.sendReset")}
                    </MenuItem>
                    {resettable ? (
                      <MenuItem icon={ShieldOffIcon} onClick={() => void actions.resetMfa(user)}>
                        {t("person.header.resetTwoStep")}
                      </MenuItem>
                    ) : null}
                  </>
                ) : null}
                <MenuItem icon={FileBracesIcon} onClick={() => setRaw(true)}>
                  {t("person.header.raw")}
                </MenuItem>
              </MenuContent>
            </Menu>
            {manage && !suspended ? (
              <Button
                variant="ghost"
                icon={LogOutIcon}
                loading={actions.pendingAction.revokeSessions}
                onClick={() => void actions.revokeSessions(user)}
              >
                {t("person.header.signOut")}
              </Button>
            ) : null}
            {manage ? (
              suspended ? (
                <Button
                  variant="soft"
                  icon={UserCheckIcon}
                  loading={actions.pendingAction.status}
                  onClick={() => actions.reactivate(user)}
                >
                  {t("person.header.reactivate")}
                </Button>
              ) : (
                <Button
                  variant="soft"
                  icon={UserXIcon}
                  loading={actions.pendingAction.status}
                  onClick={() => void actions.suspend(user)}
                >
                  {t("person.header.suspend")}
                </Button>
              )
            ) : null}
          </>
        }
        summary={
          <dl className="ppl-band prs-band">
            <div className="ppl-cell">
              <dt className="ppl-label">{t("person.band.role")}</dt>
              <dd className="ppl-value">
                {accessQ.isLoading
                  ? "…"
                  : roles.length
                    ? roles.map((r) => roleLabel(t, r.name)).join(", ")
                    : t("person.band.noRole")}
              </dd>
              <dd className="ppl-note">
                {groups.length
                  ? t("person.band.inGroups", { count: groups.length })
                  : t("person.band.noGroups")}
              </dd>
              <dd className="ppl-link">
                <RouterLink
                  to="/users/$userId"
                  params={{ userId: user.id }}
                  search={{ tab: "access" }}
                >
                  {t("person.band.whatTheyCanDo")}
                </RouterLink>
              </dd>
            </div>
            <div className="ppl-cell">
              <dt className="ppl-label">{t("person.band.twoStep")}</dt>
              <dd className="ppl-value">
                {!security
                  ? "…"
                  : security.mfa_enabled
                    ? t("person.band.on")
                    : t("person.band.off")}
              </dd>
              <dd
                className={
                  security && !security.mfa_enabled && security.password_set && !suspended
                    ? "ppl-note is-warning"
                    : "ppl-note"
                }
              >
                {!security
                  ? null
                  : [
                      security.mfa_enabled
                        ? factors.join(" · ")
                        : security.password_set && !suspended
                          ? t("person.band.passwordAlone")
                          : t("person.band.noSecondStep"),
                      security.mfa_required ? t("person.band.alwaysAsked") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </dd>
            </div>
            <div className="ppl-cell">
              <dt className="ppl-label">{t("person.band.lastActive")}</dt>
              <dd className="ppl-value">
                {latest ? (
                  <time dateTime={latest.last_seen_at}>
                    {formatRelativeTime(
                      Math.min(Date.parse(latest.last_seen_at), now),
                      locale,
                      now,
                    )}
                  </time>
                ) : lastSignIn ? (
                  <time dateTime={lastSignIn.at}>
                    {formatRelativeTime(Math.min(Date.parse(lastSignIn.at), now), locale, now)}
                  </time>
                ) : sessionsQ.isLoading ? (
                  "…"
                ) : (
                  t("person.band.never")
                )}
              </dd>
              <dd className="ppl-note">
                {latest
                  ? [parseUserAgent(latest.user_agent).label, latest.ip].filter(Boolean).join(" · ")
                  : lastSignIn
                    ? t("person.band.signedInNoSession")
                    : sessionsQ.isLoading
                      ? null
                      : t("person.band.noSignIn")}
              </dd>
              {sessions.length ? (
                <dd className="ppl-link">
                  <RouterLink
                    to="/users/$userId"
                    params={{ userId: user.id }}
                    search={{ tab: "sessions" }}
                  >
                    {t("person.band.sessions", { count: sessions.length })}
                  </RouterLink>
                </dd>
              ) : null}
            </div>
            <div className="ppl-cell">
              <dt className="ppl-label">{t("person.band.since")}</dt>
              <dd className="ppl-value">
                {new Date(user.created_at).toLocaleDateString(locale, {
                  month: "short",
                  year: "numeric",
                })}
              </dd>
              <dd className="ppl-note">
                {formatDate(user.created_at, locale, { dateStyle: "long" })}
              </dd>
            </div>
          </dl>
        }
        tabs={
          <TabsList activateOnFocus={false} aria-label={t("person.tabs.label", { name: full })}>
            <Tab value="overview">{t("person.tabs.overview")}</Tab>
            <Tab value="access">{t("person.tabs.access")}</Tab>
            <Tab value="security">{t("person.tabs.security")}</Tab>
            <Tab value="sessions" badge={sessions.length || undefined}>
              {t("person.tabs.sessions")}
            </Tab>
            <Tab value="activity">{t("person.tabs.activity")}</Tab>
          </TabsList>
        }
      />
      <PageContent>
        <TabsPanel value="overview">
          <PersonOverview
            user={user}
            standing={standing}
            security={security}
            access={accessQ.data}
            accessLoading={accessQ.isLoading}
            signIns={signInsQ.data?.events}
            signInsLoading={signInsQ.isLoading}
            canAudit={canAudit}
            onEdit={() => setEditing(true)}
            onDeleted={() => void navigate({ to: "/users" })}
          />
        </TabsPanel>
        <TabsPanel value="access">
          <PersonAccess user={user} access={accessQ.data} loading={accessQ.isLoading} />
        </TabsPanel>
        <TabsPanel value="security">
          <PersonSecurity
            user={user}
            standing={standing}
            security={security}
            loading={securityQ.isLoading}
            error={securityQ.isError ? securityQ.error : undefined}
            onRetry={() => void securityQ.refetch()}
            onSetPassword={() => setSettingPassword(true)}
          />
        </TabsPanel>
        <TabsPanel value="sessions">
          <PersonSessions
            user={user}
            standing={standing}
            sessions={sessions}
            loading={sessionsQ.isLoading}
            error={sessionsQ.isError ? sessionsQ.error : undefined}
            onRetry={() => void sessionsQ.refetch()}
            now={now}
            lastSignIn={lastSignIn}
          />
        </TabsPanel>
        <TabsPanel value="activity">
          <PersonActivity user={user} first={first} canView={canAudit} />
        </TabsPanel>
      </PageContent>

      {standing.canWrite && standing.home ? (
        <EditUserSheet user={editing ? user : null} onOpenChange={(open) => setEditing(open)} />
      ) : null}
      {manage ? (
        <SetPasswordSheet
          user={settingPassword ? user : null}
          onOpenChange={(open) => setSettingPassword(open)}
        />
      ) : null}
      <RawRecordDrawer user={raw ? user : null} onOpenChange={(open) => setRaw(open)} />
    </Tabs>
  );
}
