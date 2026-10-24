import type { SearchItem, SearchResultGroup } from "../registry/types/registry.types";
import { ResultRow } from "./result-row";

interface ResultGroupsProps {
  groups: SearchResultGroup[];
  query: string;
  highlightIndex: number; // Index into `allItems`
  allItems: SearchItem[]; // Every item, in group order
  onHighlight(idx: number): void;
  onSelect(item: SearchItem): void;
  getItemId(idx: number): string;
}

/** Renders the results as listbox option groups under sticky category headers. */
export function ResultGroups({
  groups,
  query,
  highlightIndex,
  allItems,
  onHighlight,
  onSelect,
  getItemId,
}: ResultGroupsProps) {
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map(({ category, items }) => {
        const headerId = `us-group-${category.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          // <fieldset> isn't valid inside a listbox; role="group" is the APG pattern there.
          // biome-ignore lint/a11y/useSemanticElements: listbox option groups need role="group"
          <div key={category} role="group" aria-labelledby={headerId}>
            <div
              id={headerId}
              className="sticky top-0 bg-popover px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground"
            >
              {category}
            </div>
            {items.map((item) => {
              const globalIdx = allItems.indexOf(item);
              return (
                <ResultRow
                  key={item.id}
                  id={getItemId(globalIdx)}
                  item={item}
                  query={query}
                  isHighlighted={globalIdx === highlightIndex}
                  onMouseEnter={() => onHighlight(globalIdx)}
                  onClick={() => onSelect(item)}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}
