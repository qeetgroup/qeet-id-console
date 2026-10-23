import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@qeetrix/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";

const PAGE_SIZES = [25, 50, 100];

type UsersPaginationProps = {
  page: number; // Zero-based
  pageSize: number;
  itemCount: number; // Rows on the current page
  total?: number; // Users in the organization, when the stats have loaded
  fetching: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

/** Renders the users pager: the shown range, numbered pages and the page-size select. */
export function UsersPagination({
  page,
  pageSize,
  itemCount,
  total,
  fetching,
  onPageChange,
  onPageSizeChange,
}: UsersPaginationProps) {
  const { t } = useTranslation("users");
  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const rangeStart = itemCount ? page * pageSize + 1 : 0;
  const rangeEnd = page * pageSize + itemCount;
  const hasPrev = page > 0;
  const hasNext = totalPages !== undefined ? page + 1 < totalPages : itemCount === pageSize;

  return (
    // Three tracks keep the page controls centred on the table however wide the range label or
    // size select gets; one column below sm.
    <div className="grid grid-cols-1 items-center gap-3 border-t px-4 py-3 sm:grid-cols-[1fr_auto_1fr]">
      <span className="text-sm text-muted-foreground">
        {total !== undefined
          ? t("pagination.showing", {
              start: rangeStart,
              end: rangeEnd,
              total: total.toLocaleString(formatLocale()),
            })
          : t("pagination.showingSimple", { start: rangeStart, end: rangeEnd })}
      </span>
      <div className="flex items-center justify-center gap-1 sm:order-2">
        <Button
          variant="outline"
          size="icon"
          disabled={!hasPrev || fetching}
          aria-label={t("pagination.prev")}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        {totalPages !== undefined
          ? pageWindow(page + 1, totalPages).map((p, i) =>
              p === "…" ? (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional markers
                  key={`ellipsis-${i}`}
                  className="px-1.5 text-sm text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page + 1 ? "default" : "outline"}
                  size="icon"
                  className="min-w-9"
                  disabled={fetching}
                  aria-current={p === page + 1 ? "page" : undefined}
                  onClick={() => onPageChange(p - 1)}
                >
                  {p}
                </Button>
              ),
            )
          : null}
        <Button
          variant="outline"
          size="icon"
          disabled={!hasNext || fetching}
          aria-label={t("pagination.next")}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 sm:order-3 sm:justify-self-end">
        <Select value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-32" aria-label={t("pagination.pageSize")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t("pagination.perPage", { n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Numbered-pager window: 1 … (n-1) n (n+1) … N, collapsing far pages to "…".
function pageWindow(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  if (current > 4) out.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) out.push(i);
  if (current < totalPages - 3) out.push("…");
  out.push(totalPages);
  return out;
}
