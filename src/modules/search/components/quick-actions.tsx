import { cn } from "@qeetrix/ui";
import { ArrowRightIcon, CopyIcon, ExternalLinkIcon, LinkIcon } from "@qeetrix/icons";
import type { ReactNode } from "react";

import type { SearchContext, SearchItem } from "../registry/types/registry.types";

interface QuickActionsProps {
  item: SearchItem;
  ctx: SearchContext;
  className?: string;
}

interface ResolvedAction {
  id: string;
  label: string;
  icon: ReactNode;
  run(ctx: SearchContext): void;
}

function copyToClipboard(text: string): void {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

function resolveActions(item: SearchItem, _ctx: SearchContext): ResolvedAction[] {
  const acts: ResolvedAction[] = [];

  for (const qa of item.quickActions ?? []) {
    acts.push({ id: qa.id, label: qa.label, icon: qa.icon ?? null, run: qa.run });
  }

  if (item.url != null) {
    // A const, so the closures see a string rather than the optional field.
    const itemUrl = item.url;
    acts.push({
      id: "open",
      label: "Open",
      icon: <ArrowRightIcon className="size-3" />,
      run: (c) => c.navigate(itemUrl),
    });
    acts.push({
      id: "copy-url",
      label: "Copy URL",
      icon: <LinkIcon className="size-3" />,
      run: () => copyToClipboard(itemUrl),
    });
    acts.push({
      id: "open-new-tab",
      label: "New tab",
      icon: <ExternalLinkIcon className="size-3" />,
      run: () => {
        if (typeof window !== "undefined") {
          window.open(itemUrl, "_blank", "noopener,noreferrer");
        }
      },
    });
  }

  acts.push({
    id: "copy-id",
    label: "Copy ID",
    icon: <CopyIcon className="size-3" />,
    run: () => copyToClipboard(item.id),
  });

  return acts;
}

/** Renders the item's own actions, then Open, Copy URL and New tab if it has a url, and Copy ID. */
export function QuickActions({ item, ctx, className }: QuickActionsProps) {
  const actions = resolveActions(item, ctx);
  if (actions.length === 0) return null;

  return (
    <fieldset className={cn("flex flex-wrap gap-1 border-0 p-0", className)}>
      <legend className="sr-only">Quick actions</legend>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          aria-label={action.label}
          title={action.label}
          className={cn(
            "flex items-center gap-1 rounded border px-2 py-0.5 text-xs",
            "bg-muted/50 text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          onClick={(e) => {
            e.stopPropagation();
            action.run(ctx);
          }}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </fieldset>
  );
}
