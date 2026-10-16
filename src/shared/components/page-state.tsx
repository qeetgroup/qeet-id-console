import { cn } from "@qeetrix/ui";
import type * as React from "react";

type PageStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Large status code or short marker, e.g. `403`. */
  code?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Action buttons, e.g. "Go to overview" or "Retry". */
  actions?: React.ReactNode;
};

/**
 * Full-page status layout for access, error and empty-area screens: a centred
 * column with an optional code and icon, a title, supporting text and actions.
 *
 * Console-local copy of the `PageState` block that `@qeetrix/ui` 1.x exported
 * from `@qeetrix/ui/blocks`. 2.0 removed that subpath (blocks are application
 * compositions, not library components), so the console keeps its own, built
 * only on the library's public API.
 */
export function PageState({
  code,
  icon: Icon,
  title,
  description,
  actions,
  className,
  ...props
}: PageStateProps) {
  return (
    <div
      data-slot="page-state"
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center",
        className,
      )}
      {...props}
    >
      {code != null && (
        <span className="font-heading text-5xl font-bold tracking-tight text-muted-foreground/40">
          {code}
        </span>
      )}
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
