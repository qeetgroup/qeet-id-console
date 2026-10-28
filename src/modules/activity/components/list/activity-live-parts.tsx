import { PlayIcon } from "@qeetrix/icons";
import { Badge, Button, formatNumber, Skeleton } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { LiveStatus } from "@/modules/activity/activity-live";
import type { ActivityTab } from "@/modules/activity/activity-search";

// The Activity page's header parts for live mode and its counts.

/** A tab's count: the plain number, Failed's in the danger tone, Critical's solid once any. */
export function tabBadge(
  tab: ActivityTab,
  count: number | undefined,
  n: (value: number) => string,
) {
  if (count === undefined) return undefined;
  if (tab === "all") return count;
  if (!count) return n(count);
  return (
    <Badge tone="danger" variant={tab === "critical" ? "solid" : "subtle"} size="sm">
      {n(count)}
    </Badge>
  );
}

export function LiveBadge({ status }: { status: LiveStatus }) {
  const { t } = useTranslation("activity");
  if (status === "off") return null;
  const tone = status === "live" ? "success" : status === "stalled" ? "warning" : "neutral";
  return <Badge tone={tone}>{t(`page.status.${status}`)}</Badge>;
}

/** What live mode needs to say: paused (and what's waiting), newer events, or no answer. */
export function LiveNotice({
  status,
  pausedAt,
  pending,
  onResume,
  onNewest,
}: {
  status: LiveStatus;
  pausedAt: number | null;
  pending: number;
  onResume: () => void;
  onNewest: () => void;
}) {
  const { t } = useTranslation("activity");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  if (status === "paused" && pausedAt) {
    const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(pausedAt);
    return (
      <Alert
        tone="info"
        title={t("page.paused.title")}
        actions={
          <Button variant="ghost" icon={PlayIcon} onClick={onResume}>
            {t("page.resume")}
          </Button>
        }
      >
        {t("page.paused.body", { time })}
      </Alert>
    );
  }
  if (status === "stalled") {
    return (
      <Alert tone="warning" title={t("page.stalled.title")}>
        {t("page.stalled.body")}
      </Alert>
    );
  }
  if (pending) {
    return (
      <Alert
        tone="info"
        announce="polite"
        title={t("page.newer.title", { count: pending, n: n(pending) })}
        actions={
          <Button variant="ghost" onClick={onNewest}>
            {t("page.newer.show")}
          </Button>
        }
      >
        {t("page.newer.body")}
      </Alert>
    );
  }
  return null;
}

/** The band's place while its numbers load, so the header doesn't jump when they arrive. */
export function BandPlaceholder() {
  return (
    <div className="ppl-band" aria-hidden="true">
      {[0, 1, 2, 3].map((cell) => (
        <div key={cell} className="ppl-cell">
          <Skeleton className="ppl-skeleton-label" />
          <Skeleton className="ppl-skeleton-value" />
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
