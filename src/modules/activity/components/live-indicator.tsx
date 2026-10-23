import { cn } from "@qeetrix/ui";
import { RadioIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { StatusPill } from "@/platform/components/status-pill";
import type { ConnectionStatus } from "../types/activity.types";

const STATUS_RING_CLASS: Record<ConnectionStatus, string> = {
  connected: "border-success/40 text-success",
  reconnecting: "border-warning/40 text-warning",
  disconnected: "border-destructive/40 text-destructive",
  paused: "border-muted-foreground/40 text-muted-foreground",
};

const STATUS_ICON_CLASS: Record<ConnectionStatus, string> = {
  connected: "text-success",
  reconnecting: "text-warning",
  disconnected: "text-destructive",
  paused: "text-muted-foreground",
};

const UNREAD_KIND: Partial<Record<ConnectionStatus, "success" | "warning" | "danger" | "muted">> = {
  connected: "success",
  reconnecting: "warning",
  paused: "muted",
};

/** Renders the stream's connection state and, when non-zero, the unread event count. */
export function LiveIndicator({
  status,
  unreadCount,
  className,
}: {
  status: ConnectionStatus;
  unreadCount?: number;
  className?: string;
}) {
  const { t } = useTranslation("activity");
  const label = t(`liveIndicator.status.${status}`);
  const isPulsing = status === "connected" || status === "reconnecting";

  return (
    <div className={cn("flex items-center gap-2", className)} aria-live="polite" aria-atomic="true">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium",
          STATUS_RING_CLASS[status],
        )}
        title={label}
      >
        <RadioIcon
          className={cn("size-3", isPulsing && "animate-pulse", STATUS_ICON_CLASS[status])}
          aria-hidden="true"
        />
        {label}
      </span>

      {unreadCount !== undefined && unreadCount > 0 && (
        <StatusPill kind={UNREAD_KIND[status] ?? "neutral"} dot={false}>
          {t("activityModeToggle.new", { count: unreadCount > 99 ? "99+" : unreadCount })}
        </StatusPill>
      )}
    </div>
  );
}
