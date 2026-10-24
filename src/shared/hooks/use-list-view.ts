import { useMemo, useState } from "react";

// Client-side list view state (search, facet filters, single-column sort, density, column
// visibility) over the rows the page already holds, so it composes with server pagination.

export type Density = "comfortable" | "compact";

export type SortDir = "asc" | "desc";

export type SortState = { key: string; dir: SortDir } | null;

export type ListViewConfig<T> = {
  searchFields: (row: T) => Array<string | null | undefined>; // searched case-insensitively
  filterFields?: Record<string, (row: T) => string | null | undefined>; // facet id → accessor
  sortFields?: Record<string, (row: T) => string | number | null | undefined>; // by column id
  initialHidden?: string[]; // column ids that start hidden
  initialDensity?: Density;
};

export function useListView<T>(rows: T[], config: ListViewConfig<T>) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(null);
  const [density, setDensity] = useState<Density>(config.initialDensity ?? "comfortable");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(config.initialHidden ?? []));

  const view = useMemo(() => {
    let out = rows;

    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((row) =>
        config.searchFields(row).some((f) => (f ?? "").toLowerCase().includes(q)),
      );
    }

    const active = Object.entries(filters).filter(([, v]) => v && v !== "all");
    if (active.length && config.filterFields) {
      out = out.filter((row) =>
        active.every(([key, val]) => {
          const accessor = config.filterFields?.[key];
          return accessor ? (accessor(row) ?? "") === val : true;
        }),
      );
    }

    const sortAccessor = sort ? config.sortFields?.[sort.key] : undefined;
    if (sort && sortAccessor) {
      const dir = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = sortAccessor(a) ?? "";
        const bv = sortAccessor(b) ?? "";
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    return out;
  }, [rows, search, filters, sort, config]);

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function toggleColumn(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isVisible = (id: string) => !hidden.has(id);
  const hasActiveFilters =
    search.trim() !== "" || Object.values(filters).some((v) => v && v !== "all");

  function clear() {
    setSearch("");
    setFilters({});
  }

  return {
    view,
    search,
    setSearch,
    filters,
    setFilter,
    sort,
    toggleSort,
    density,
    setDensity,
    isVisible,
    toggleColumn,
    hidden,
    hasActiveFilters,
    clear,
  };
}
