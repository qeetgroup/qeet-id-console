import { Tooltip, TooltipContent, TooltipTrigger } from "@qeetrix/ui";
import { ClipboardIcon } from "@qeetrix/icons";
import { type ReactNode, useCallback } from "react";

/** Renders an icon button that copies `text`, labelled and tooltipped by `label`. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={handleCopy}
            aria-label={label}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ClipboardIcon className="size-3.5" aria-hidden="true" />
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Renders one label/value pair of a drawer section's `<dl>`. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs text-foreground">{children}</dd>
    </div>
  );
}

/** Renders a drawer section's small uppercase heading. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}
