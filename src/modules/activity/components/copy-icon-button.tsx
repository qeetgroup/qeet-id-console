import { cn, Tooltip, TooltipContent, TooltipTrigger, useCopyToClipboard } from "@qeetrix/ui";
import { CheckIcon, ClipboardIcon } from "@qeetrix/icons";

/**
 * Renders an icon-only copy button. `relative z-1` keeps it clickable above stretched-link row
 * overlays; with `revealOnHover` it shows only on hover or focus inside a `group`.
 */
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
