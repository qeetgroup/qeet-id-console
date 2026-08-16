// Live vs History mode toggle + "N new events" jump affordance.
// Live streams SSE events into the feed; History freezes the stream so an
// operator can investigate a pinned window without rows shifting underfoot.
// When live events buffer up, the jump button scrolls to the top and marks read.
//
// This is a hand-rolled segmented control rather than @qeetrix/ui's
// SegmentedControl: that component positions its sliding highlight in a
// useLayoutEffect keyed only on `orientation`, so a controlled `value` change
// (Live→History) never moves the highlight. Reflecting `mode` directly on each
// button avoids that.

import { Button, cn } from "@qeetrix/ui";
import { ArrowUpIcon } from "lucide-react";

import type { ActivityMode } from "../types";

const MODES: { value: ActivityMode; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "history", label: "History" },
];

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
