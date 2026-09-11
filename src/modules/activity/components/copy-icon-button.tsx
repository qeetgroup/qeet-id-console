// Small icon-only copy control built on the shared useCopyToClipboard hook.
// Sits above stretched-link row overlays via `relative z-1`, and reveals on
// hover/focus inside a `group` when `revealOnHover` is set.

import { cn, Tooltip, TooltipContent, TooltipTrigger, useCopyToClipboard } from "@qeetrix/ui";
import { CheckIcon, ClipboardIcon } from "lucide-react";

export function CopyIconButton({
  text,
  label,
  className,
  revealOnHover = false,
}: {
  text: string;
  label: string;
  className?: string;
  revealOnHover?: boolean;
}) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copy(text);
            }}
            aria-label={label}
            className={cn(
              "relative z-1 inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              revealOnHover && "opacity-0 group-hover:opacity-100",
              className,
            )}
          >
            {copied ? (
              <CheckIcon className="size-3 text-success" aria-hidden="true" />
            ) : (
              <ClipboardIcon className="size-3" aria-hidden="true" />
            )}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
