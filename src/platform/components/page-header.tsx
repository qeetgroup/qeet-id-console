import { useLocation } from "@tanstack/react-router";
import type * as React from "react";

import { lookupNavTitle } from "@/platform/config/navigation";

type PageHeaderProps = {
  /** Overrides the auto-detected title (useful for detail pages). */
  title?: string;
  /** One-line description shown below the title. */
  description?: string;
  /** Optional leading glyph, rendered in a tinted tile before the title. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional action area (buttons, dropdowns) shown on the right side. */
  actions?: React.ReactNode;
};

/**
 * Standard top-of-page header. Mirrors the look of the catch-all
 * placeholder so every screen has a consistent title block.
 *
 * Title auto-resolves from the navigation config based on the current
 * pathname — override with the `title` prop for detail screens whose
 * path isn't in the static nav tree.
 */
export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  const { pathname } = useLocation();
  const meta = lookupNavTitle(pathname);

  return (
    <header className="page-heading">
      <div className="flex min-w-0 items-start gap-4">
        {Icon && (
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <Icon className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-pretty font-heading text-2xl font-semibold sm:text-[1.75rem]">
            {title ?? meta.title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-3xl text-pretty text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}
