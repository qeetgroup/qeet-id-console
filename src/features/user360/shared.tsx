// Small shared UI atoms for the User 360 workspace.

import { Tooltip, TooltipContent, TooltipTrigger, useCopyToClipboard } from "@qeetrix/ui";
import { CheckIcon, CopyIcon } from "lucide-react";

import { truncateId } from "./utils";

/**
 * A copyable identifier — shows the id (optionally truncated, monospace) with a
 * small copy affordance that always copies the *full* value.
 */
export function CopyId({
  value,
  truncate = true,
  label = "Copy",
}: {
  value: string;
  truncate?: boolean;
  label?: string;
}) {
  const { copied, copy } = useCopyToClipboard();
  const shown = truncate ? truncateId(value) : value;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span className="truncate">{shown}</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => copy(value)}
              aria-label={label}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? (
                <CheckIcon className="size-3 text-success" aria-hidden="true" />
              ) : (
                <CopyIcon className="size-3" aria-hidden="true" />
              )}
            </button>
          }
        />
        <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
      </Tooltip>
    </span>
  );
}

/** A labelled key/value row used across the Overview cards. */
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium">{children}</span>
    </div>
  );
}

/** A count row (label on the left, big number on the right) for Access summary. */
export function CountRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </div>
      <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}
