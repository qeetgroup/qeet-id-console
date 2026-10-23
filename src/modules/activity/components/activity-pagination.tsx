import { Trans, useTranslation } from "react-i18next";
import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@qeetrix/icons";

import { formatLocale } from "@/i18n";

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** Returns the 1-based pages to show (first, last, current ±1) with "…" for each gap. */
function pageWindow(current: number, count: number): (number | "…")[] {
  const wanted = new Set<number>([1, count, current, current - 1, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/** Renders the Activity table footer: row range, windowed page buttons and page size. */
export function ActivityPagination({
  page,
  pageCount,
  pageSize,
  total,
  itemsOnPage,
  onPageChange,
  onPageSizeChange,
  loading = false,
}: {
  page: number; // 0-based; labels are 1-based
  pageCount: number;
  pageSize: number;
  total: number;
  itemsOnPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
}) {
  const { t } = useTranslation("activity");
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = page * pageSize + itemsOnPage;
  const current = page + 1; // 1-based
  const windowed = pageWindow(current, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-2.5 text-xs lg:px-4">
      <span className="text-muted-foreground" aria-live="polite">
        <Trans
          t={t}
          i18nKey="activityPagination.showing"
          values={{
            from: from.toLocaleString(formatLocale()),
            to: to.toLocaleString(formatLocale()),
            total: total.toLocaleString(formatLocale()),
          }}
          components={{ n: <span className="font-medium text-foreground tabular-nums" /> }}
        />
      </span>

      <nav className="flex items-center gap-1" aria-label={t("activityPagination.pagination")}>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-7"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0 || loading}
          aria-label={t("activityPagination.previousPage")}
        >
          <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
        </Button>

        {windowed.map((p, i) =>
          p === "…" ? (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: static ellipsis position
              key={`gap-${i}`}
              className="px-1 text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === current ? "default" : "outline"}
              size="icon-sm"
              className={cn("size-7 tabular-nums", p === current && "pointer-events-none")}
              onClick={() => onPageChange(p - 1)}
              disabled={loading}
              aria-label={t("activityPagination.page", { page: p })}
              aria-current={p === current ? "page" : undefined}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon-sm"
          className="size-7"
          onClick={() => onPageChange(page + 1)}
          disabled={current >= pageCount || loading}
          aria-label={t("activityPagination.nextPage")}
        >
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </nav>

      <Select value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
        <SelectTrigger className="h-7 w-28" aria-label={t("activityPagination.rowsPerPage")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {t("activityPagination.perPage", { count: n })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
