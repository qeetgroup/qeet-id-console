import { useTranslation } from "react-i18next";
import { Button, cn } from "@qeetrix/ui";
import { ArrowUpIcon } from "@qeetrix/icons";

import type { ActivityMode } from "../types/activity.types";

const MODES: ActivityMode[] = ["live", "history"]; // labelled `activityModeToggle.mode.<mode>`

/**
 * Renders the Live / History toggle and, in live mode, a "N new" jump button. History freezes
 * the feed so a pinned window can be investigated without rows shifting.
 */
export function ActivityModeToggle({
  mode,
  onModeChange,
  newCount,
  onJumpToNew,
  className,
}: {
  mode: ActivityMode;
  onModeChange: (mode: ActivityMode) => void;
  newCount: number;
  onJumpToNew?: () => void;
  className?: string;
}) {
  const { t } = useTranslation("activity");
  // Hand-rolled: @qeetrix/ui's SegmentedControl doesn't move its highlight when a controlled
  // `value` changes.
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="inline-flex h-8 items-center rounded-lg bg-muted p-1 text-xs">
        <span className="sr-only">{t("activityModeToggle.feedMode")}</span>
        {MODES.map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(m)}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5 dark:bg-input/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`activityModeToggle.mode.${m}`)}
            </button>
          );
        })}
      </div>

      {mode === "live" && newCount > 0 && onJumpToNew && (
        <Button
          variant="outline"
          size="sm"
          onClick={onJumpToNew}
          className="fade-in-0 animate-in"
          aria-label={t("activityModeToggle.jumpToNew", { count: newCount })}
        >
          <ArrowUpIcon className="size-3.5" aria-hidden="true" />
          {t("activityModeToggle.new", { count: newCount > 99 ? "99+" : newCount })}
        </Button>
      )}
    </div>
  );
}
