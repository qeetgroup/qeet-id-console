import { Button, useCopyToClipboard } from "@qeetrix/ui";
import { CheckIcon, CopyIcon } from "@qeetrix/icons";
import type { ReactNode } from "react";

/** Section title block: tiled icon, title, subtitle, and an optional status chip. */
export function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-none">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** Read-only URL the admin has to paste into the provider's own console. */
export function CopyableUrlPanel({
  icon,
  title,
  value,
  help,
  copyLabel,
  copiedLabel,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  help: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? copiedLabel : copyLabel}
          onClick={() => copy(value)}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-success" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{help}</p>
    </div>
  );
}
