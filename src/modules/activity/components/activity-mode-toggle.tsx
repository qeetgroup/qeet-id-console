import { Button, cn } from "@qeetrix/ui";
import { ArrowUpIcon } from "@qeetrix/icons";

import type { ActivityMode } from "../types/activity.types";

const MODES: { value: ActivityMode; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "history", label: "History" },
];

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
  // Hand-rolled: @qeetrix/ui's SegmentedControl doesn't move its highlight when a controlled
  // `value` changes.
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="inline-flex h-8 items-center rounded-lg bg-muted p-1 text-xs">
        <span className="sr-only">Feed mode</span>
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(m.value)}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5 dark:bg-input/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
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
          aria-label={`Jump to ${newCount} new events`}
        >
          <ArrowUpIcon className="size-3.5" aria-hidden="true" />
          {newCount > 99 ? "99+" : newCount} new
        </Button>
      )}
    </div>
  );
}
