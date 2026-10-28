import { LogOutIcon, MonitorIcon, RefreshCwIcon, SmartphoneIcon, TabletIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDateTime,
  formatRelativeTime,
  Link,
  Table,
  type TableColumn,
  Text,
  VisuallyHidden,
} from "@qeetrix/react";
import { EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type Session,
  sessionCountry,
  sessionDevice,
  sessionStatus,
  useRevokeSession,
  useSessions,
} from "@/modules/authentication";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useSessionId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { formatIp } from "@/shared/utils/ip-format";
import "./person/person.css";

function DeviceIcon({ session }: { session: Session }) {
  const Icon =
    session.device_kind === "mobile"
      ? SmartphoneIcon
      : session.device_kind === "tablet"
        ? TabletIcon
        : MonitorIcon;
  return (
    <span className="prs-icon" aria-hidden="true">
      <Icon />
    </span>
  );
}

/**
 * Your sessions, under Users: a kept duplicate of My account › Sessions (the user's decision,
 * 2026-10-26: removed later). Every session you have, newest first, and a way to end any but the
 * one you're using; ending them all is on My account › Sessions.
 */
export function UserSessionsPage() {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const runSensitive = useSensitiveAction();
  const sessionId = useSessionId();
  const items = [...(sessions.data?.items ?? [])].sort((a, b) =>
    b.last_seen_at.localeCompare(a.last_seen_at),
  );
  const isHere = (s: Session) => s.current ?? s.id === sessionId;
  const now = sessions.dataUpdatedAt || Date.now();
  const when = (at: string) => formatRelativeTime(Math.min(Date.parse(at), now), locale, now);

  const signOut = (s: Session) =>
    void runSensitive({
      confirm: {
        title: t("mySessions.confirmTitle", { device: sessionDevice(s) }),
        description: t("mySessions.confirmDescription"),
        confirmLabel: t("mySessions.signOut"),
        tone: "destructive",
      },
      actionLabel: t("mySessions.signOut"),
      run: () => revoke.mutateAsync(s.id),
    }).catch(settleSensitiveAction);

  const columns: TableColumn<Session>[] = [
    {
      id: "device",
      header: t("mySessions.device"),
      primary: true,
      cell: (s) => (
        <span className="prs-row-name">
          <DeviceIcon session={s} />
          <span title={s.user_agent ?? undefined}>{sessionDevice(s)}</span>
          {isHere(s) ? (
            <Badge tone="brand" size="sm">
              {t("mySessions.here")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "where",
      header: t("mySessions.where"),
      cell: (s) =>
        [sessionCountry(s, locale), formatIp(s.ip)].filter(Boolean).join(" · ") || (
          <Text tone="subtle">—</Text>
        ),
    },
    {
      id: "opened",
      header: t("mySessions.signedIn"),
      width: 150,
      cell: (s) => (
        <time dateTime={s.created_at} title={formatDateTime(s.created_at, locale)}>
          {when(s.created_at)}
        </time>
      ),
    },
    {
      id: "seen",
      header: t("mySessions.lastActive"),
      width: 150,
      cell: (s) => (
        <time dateTime={s.last_seen_at} title={formatDateTime(s.last_seen_at, locale)}>
          {when(s.last_seen_at)}
        </time>
      ),
    },
    {
      id: "status",
      header: t("mySessions.status"),
      width: 120,
      cell: (s) => {
        const status = sessionStatus(s);
        return (
          <Badge tone={status === "active" ? "success" : "neutral"} size="sm">
            {t(`mySessions.statuses.${status}`)}
          </Badge>
        );
      },
    },
    {
      id: "end",
      header: <VisuallyHidden>{t("mySessions.actions")}</VisuallyHidden>,
      align: "end",
      width: 120,
      cell: (s) =>
        sessionStatus(s) === "active" && !isHere(s) ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("mySessions.signOutLabel", { device: sessionDevice(s) })}
            disabled={revoke.isPending && revoke.variables === s.id}
            onClick={() => signOut(s)}
          >
            {t("mySessions.signOut")}
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("mySessions.title")}
        count={
          sessions.data ? items.filter((s) => sessionStatus(s) === "active").length : undefined
        }
        description={t("mySessions.description")}
        actions={
          <Button
            variant="ghost"
            icon={RefreshCwIcon}
            loading={sessions.isFetching && !sessions.isLoading}
            onClick={() => void sessions.refetch()}
          >
            {t("mySessions.refresh")}
          </Button>
        }
      />
      <PageContent>
        <div className="prs-page">
          <section className="prs-section">
            <Table<Session>
              label={t("mySessions.title")}
              rows={items}
              rowId={(s) => s.id}
              rowLabel={sessionDevice}
              columns={columns}
              loading={sessions.isLoading}
              empty={<EmptyState size="section" icon={LogOutIcon} title={t("mySessions.empty")} />}
              error={
                sessions.isError ? (
                  <EmptyState
                    size="section"
                    icon={LogOutIcon}
                    tone="danger"
                    title={t("mySessions.loadFailed")}
                    description={errorMessage(sessions.error)}
                    actions={
                      <Button size="sm" variant="soft" onClick={() => void sessions.refetch()}>
                        {t("person.tryAgain")}
                      </Button>
                    }
                  />
                ) : undefined
              }
            />
            <p className="prs-note">
              {t("mySessions.everywhere")}{" "}
              <Link render={<RouterLink to="/account/sessions" />}>{t("mySessions.account")}</Link>
            </p>
          </section>
        </div>
      </PageContent>
    </>
  );
}
