import { ArrowDown, ArrowUp, ArrowsSwapVertical } from "@qeetrix/icons";
import { cn, TableHead } from "@qeetrix/ui";

import type { SortState } from "@/shared/hooks/use-list-view";

type SortHeaderProps = {
  columnKey: string;
  sort: SortState;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  className?: string;
};

// A TableHead whose label is a button that cycles asc → desc → none and
// shows the active direction. Pairs with useListView's sort state.
export function SortHeader({ columnKey, sort, onToggle, children, className }: SortHeaderProps) {
  const active = sort?.key === columnKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onToggle(columnKey)}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium uppercase tracking-wide hover:text-foreground"
      >
        {children}
        {active ? (
          sort?.dir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowsSwapVertical className={cn("size-3.5 opacity-40")} />
        )}
      </button>
    </TableHead>
  );
}
