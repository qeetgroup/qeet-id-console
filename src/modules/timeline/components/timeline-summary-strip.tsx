import { cn, Skeleton } from "@qeetrix/ui";
import {
  ActivityIcon,
  CodeXmlIcon,
  LogInIcon,
  ShieldIcon,
  UsersIcon,
  type IconProps,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { ActivityEvent } from "@/modules/activity";
import { computeTimelineSummary, SUMMARY_CATEGORY_FILTERS } from "../timeline-summary";

type Tone = "brand" | "info" | "danger" | "warning" | "success";

const TONE_ICON: Record<Tone, string> = {
  brand: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
};

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}

function sharePercent(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  active,
  onClick,
}: {
  icon: ComponentType<IconProps<"outline">>;
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-tone={tone}
      className={cn(
        "dashboard-metric group text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active && "bg-muted/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-current/10 [&_svg]:size-3.5",
            TONE_ICON[tone],
          )}
        >
          <Icon aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2.5 font-heading text-2xl font-semibold leading-none tabular-nums">
        {value.toLocaleString(formatLocale())}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
    </button>
  );
}

/**
 * Renders five stat cards counted from the loaded timeline events. A card applies its category
 * filter when clicked; Total clears it.
 */
export function TimelineSummaryStrip({
  events,
  loading,
  activeCategories,
  onSelectCategories,
}: {
  events: ActivityEvent[];
  loading: boolean;
  activeCategories: string[];
  onSelectCategories: (categories: string[]) => void;
}) {
  const { t } = useTranslation("timeline");
  if (loading && events.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-busy="true">
        {["a", "b", "c", "d", "e"].map((k) => (
          <div key={k} className="dashboard-metric">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-14" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  const s = computeTimelineSummary(events);
  const noneActive = activeCategories.length === 0;

  const cards: {
    key: string;
    icon: ComponentType<IconProps<"outline">>;
    label: string;
    value: number;
    sub: string;
    tone: Tone;
    categories: readonly string[];
  }[] = [
    {
      key: "total",
      icon: ActivityIcon,
      label: t("timelineSummaryStrip.totalEvents"),
      value: s.total,
      sub: t("timelineSummaryStrip.inThisView"),
      tone: "brand",
      categories: [],
    },
    {
      key: "authentication",
      icon: LogInIcon,
      label: t("timelineSummaryStrip.authentication"),
      value: s.authentication,
      sub: t("timelineSummaryStrip.share", { percent: sharePercent(s.authentication, s.total) }),
      tone: "info",
      categories: SUMMARY_CATEGORY_FILTERS.authentication,
    },
    {
      key: "security",
      icon: ShieldIcon,
      label: t("timelineSummaryStrip.security"),
      value: s.security,
      sub: t("timelineSummaryStrip.share", { percent: sharePercent(s.security, s.total) }),
      tone: "danger",
      categories: SUMMARY_CATEGORY_FILTERS.security,
    },
    {
      key: "directory",
      icon: UsersIcon,
      label: t("timelineSummaryStrip.directory"),
      value: s.directory,
      sub: t("timelineSummaryStrip.share", { percent: sharePercent(s.directory, s.total) }),
      tone: "warning",
      categories: SUMMARY_CATEGORY_FILTERS.directory,
    },
    {
      key: "developer",
      icon: CodeXmlIcon,
      label: t("timelineSummaryStrip.developer"),
      value: s.developer,
      sub: t("timelineSummaryStrip.share", { percent: sharePercent(s.developer, s.total) }),
      tone: "success",
      categories: SUMMARY_CATEGORY_FILTERS.developer,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const active =
          card.categories.length === 0 ? noneActive : sameSet(activeCategories, card.categories);
        return (
          <StatCard
            key={card.key}
            icon={card.icon}
            label={card.label}
            value={card.value}
            sub={card.sub}
            tone={card.tone}
            active={active}
            onClick={() => onSelectCategories([...card.categories])}
          />
        );
      })}
    </div>
  );
}
