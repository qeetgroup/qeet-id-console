import { ArrowLeftAlt, ArrowRightAlt } from "@qeetrix/icons";
// Numbered pagination footer for the Activity table — "Showing X to Y of N",
// windowed page buttons (1 … 4 5 6 … 249), prev/next, and a page-size selector.
// Pages are 0-based in props; labels are 1-based.

import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** Windowed page list: first, last, current ±1, with "…" gaps. 1-based. */
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
  page: number; // 0-based
  pageCount: number;
  pageSize: number;
  total: number;
  itemsOnPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
}) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = page * pageSize + itemsOnPage;
  const current = page + 1; // 1-based
  const windowed = pageWindow(current, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-2.5 text-xs lg:px-4">
      <span className="text-muted-foreground" aria-live="polite">
        Showing{" "}
        <span className="font-medium text-foreground tabular-nums">{from.toLocaleString()}</span> to{" "}
        <span className="font-medium text-foreground tabular-nums">{to.toLocaleString()}</span> of{" "}
        <span className="font-medium text-foreground tabular-nums">{total.toLocaleString()}</span>{" "}
        events
      </span>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="outline"
          size="icon-sm"
          className="size-7"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0 || loading}
          aria-label="Previous page"
        >
          <ArrowLeftAlt className="size-3.5" aria-hidden="true" />
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
              aria-label={`Page ${p}`}
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
          aria-label="Next page"
        >
          <ArrowRightAlt className="size-3.5" aria-hidden="true" />
        </Button>
      </nav>

      <Select value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
        <SelectTrigger className="h-7 w-28" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} / page
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
