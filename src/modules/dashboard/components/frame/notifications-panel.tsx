import {
  BellIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import { Badge, Button, formatRelativeTime, Link, Skeleton, Text } from "@qeetrix/react";
import { Alert, EmptyState } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type Notification,
  type NotificationKind,
  useMarkAllRead,
  useNotifications,
} from "@/modules/developer";

const KIND_ICON = {
  alert: CircleAlertIcon,
  warning: TriangleAlertIcon,
  success: CircleCheckIcon,
  info: InfoIcon,
} as const satisfies Record<NotificationKind, unknown>;

/** Whether anything is unread, for the dot on the bar's bell; `enabled` false skips asking. */
export function useHasUnreadNotifications(enabled = true): boolean {
  return (useNotifications(enabled).data?.unread_count ?? 0) > 0;
}

/**
 * The Notifications panel, in the shell's end-edge panel: the unread count with "Mark all as read",
 * a ruled list, and a way to all activity. A notification with a link opens it; one without (a
 * device sign-in request) is plain text.
 */
export function NotificationsPanel() {
  const { t } = useTranslation("dashboard");
  const notifications = useNotifications();
  const markAll = useMarkAllRead();

  if (notifications.isPending) {
    return (
      <div className="frame-notes" role="status" aria-label={t("frame.notifications.loading")}>
        <Skeleton lines={2} />
        <Skeleton lines={2} />
        <Skeleton lines={2} />
      </div>
    );
  }
  if (notifications.isError) {
    return (
      <Alert
        tone="danger"
        title={t("frame.notifications.errorTitle")}
        actions={
          <Button
            size="sm"
            variant="soft"
            icon={RefreshCwIcon}
            onClick={() => void notifications.refetch()}
          >
            {t("frame.notifications.tryAgain")}
          </Button>
        }
      >
        {t("frame.notifications.errorText")}
      </Alert>
    );
  }

  const { items, unread_count: unread } = notifications.data;
  const viewAll = (
    <Link render={<RouterLink to="/activity" />}>{t("frame.notifications.viewAll")}</Link>
  );
  if (items.length === 0) {
    return (
      <EmptyState
        size="section"
        icon={BellIcon}
        title={t("frame.notifications.emptyTitle")}
        description={t("frame.notifications.emptyText")}
      >
        {viewAll}
      </EmptyState>
    );
  }
  return (
    <div className="frame-notes">
      <div className="frame-notes-head">
        <Text size="sm" tone="subtle">
          {unread > 0
            ? t("frame.notifications.unread", { count: unread })
            : t("frame.notifications.noUnread")}
        </Text>
        {unread > 0 && (
          <Button
            size="sm"
            variant="ghost"
            tone="neutral"
            icon={CheckCheckIcon}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {t("frame.notifications.markAllRead")}
          </Button>
        )}
      </div>
      <ul className="frame-notes-list" aria-label={t("frame.notifications.list")}>
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow item={item} />
          </li>
        ))}
      </ul>
      <div className="frame-notes-foot">{viewAll}</div>
    </div>
  );
}

/** One notification: its status icon in the status colour, title, two lines, the time, "New". */
function NotificationRow({ item }: { item: Notification }) {
  const { t } = useTranslation("dashboard");
  const Icon = KIND_ICON[item.kind] ?? InfoIcon;
  const content = (
    <>
      <Icon shape="sharp" size={16} aria-hidden="true" className="frame-note-icon" />
      <span className="frame-note-text">
        <span className="frame-note-title">
          <strong>{item.title}</strong>
          {!item.read_at && <Badge tone="brand">{t("frame.notifications.new")}</Badge>}
        </span>
        {item.description && <small>{item.description}</small>}
        <time dateTime={item.created_at}>
          {formatRelativeTime(new Date(item.created_at), formatLocale())}
        </time>
      </span>
    </>
  );
  const attrs = {
    className: "frame-note",
    "data-kind": item.kind,
    "data-unread": item.read_at ? undefined : "",
  };
  // The link comes from the server: only a path in the console opens; anything else is text.
  const href = item.href?.startsWith("/") && !item.href.startsWith("//") ? item.href : null;
  return href ? (
    <RouterLink to={href as never} {...attrs}>
      {content}
    </RouterLink>
  ) : (
    <div {...attrs}>{content}</div>
  );
}
