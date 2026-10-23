import { useLocation } from "@tanstack/react-router";
import type * as React from "react";

import { lookupNavTitle } from "@/platform/config/navigation";

type PageHeaderProps = {
  title?: string; // overrides the title found in the navigation config
  description?: string; // one line, shown below the title
  icon?: React.ComponentType<{ className?: string }>; // leading glyph, in a tinted tile
  actions?: React.ReactNode; // buttons or menus, on the right
};

/**
 * Renders the standard page title block. The title comes from the navigation config for the
 * current path; pass `title` for a detail page outside the nav tree.
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
