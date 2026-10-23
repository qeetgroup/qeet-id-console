import { Badge, cn, Separator } from "@qeetrix/ui";
import { StarIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { StatusPill } from "@/platform/components/status-pill";

import type { SearchContext, SearchItem } from "../registry/types/registry.types";
import { QuickActions } from "./quick-actions";

interface PreviewPaneProps {
  item: SearchItem;
  ctx: SearchContext;
  isFavorite: boolean;
  onToggleFavorite(): void;
}

/** Renders the highlighted item's details, favorite toggle and quick actions. */
export function PreviewPane({ item, ctx, isFavorite, onToggleFavorite }: PreviewPaneProps) {
  const { t } = useTranslation("search");
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-start gap-2">
        {item.icon != null && (
          <span
            className="grid size-8 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            {item.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.title}</div>
          {item.subtitle != null && (
            <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
          )}
        </div>
        <button
          type="button"
          aria-label={t(isFavorite ? "previewPane.removeFavorite" : "previewPane.addFavorite")}
          aria-pressed={isFavorite}
          onClick={onToggleFavorite}
          className={cn(
            "shrink-0 rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // A starred item stays amber so the filled star reads as active.
            isFavorite ? "text-warning" : "text-muted-foreground hover:text-warning",
          )}
        >
          <StarIcon
            className="size-3.5"
            fill={isFavorite ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Kind + status badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] capitalize">
          {item.kind}
        </Badge>
        {item.status != null && <StatusPill status={item.status} className="text-[10px]" />}
      </div>

      {/* Metadata */}
      {item.metadata != null && Object.keys(item.metadata).length > 0 && (
        <>
          <Separator />
          <dl className="flex flex-col gap-1.5 text-xs">
            {Object.entries(item.metadata).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                <dd className="truncate font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {/* Updated timestamp */}
      {item.updatedAt != null && (
        <p className="text-xs text-muted-foreground">
          {t("previewPane.updated", {
            date: new Date(item.updatedAt).toLocaleDateString(formatLocale(), {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          })}
        </p>
      )}

      {/* Quick actions */}
      <div className="mt-auto pt-2">
        <QuickActions item={item} ctx={ctx} />
      </div>
    </div>
  );
}
