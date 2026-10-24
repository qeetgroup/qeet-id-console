import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import {
  DownloadIcon,
  Rows2Icon,
  Rows3Icon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "@qeetrix/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Density } from "@/shared/hooks/use-list-view";

export type FacetFilter = {
  id: string;
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
};

export type ToggleColumn = { id: string; label: string };

type ListToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FacetFilter[];
  columns?: ToggleColumn[];
  isColumnVisible?: (id: string) => boolean;
  onToggleColumn?: (id: string) => void;
  density?: Density;
  onDensityChange?: (density: Density) => void;
  onExport?: (format: "csv" | "json") => void;
  exportDisabled?: boolean;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  children?: ReactNode; // primary actions such as "New …", at the far right
};

/**
 * Renders the list-page toolbar: search and facet filters on the left; view controls, export and
 * page actions on the right. Each control appears only when its props are given.
 */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  columns,
  isColumnVisible,
  onToggleColumn,
  density,
  onDensityChange,
  onExport,
  exportDisabled,
  hasActiveFilters,
  onClear,
  children,
}: ListToolbarProps) {
  const { t } = useTranslation("common");
  return (
    <search
      className="flex flex-col gap-3 border-y border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:px-4"
      aria-label={t("listToolbar.listControls")}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? t("listToolbar.search")}
            className="ps-9"
            aria-label={t("actions.search")}
          />
        </div>

        {filters?.map((f) => (
          <Select key={f.id} value={f.value || "all"} onValueChange={(v) => v && f.onChange(v)}>
            <SelectTrigger size="sm" className="w-auto min-w-32" aria-label={f.label}>
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("listToolbar.allOf", { label: f.label })}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {hasActiveFilters && onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <XIcon /> {t("listToolbar.clear")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {density && onDensityChange && (
          <Button
            variant="outline"
            size="icon"
            aria-label={t(
              density === "compact" ? "listToolbar.comfortableRows" : "listToolbar.compactRows",
            )}
            title={t(
              density === "compact" ? "listToolbar.comfortableRows" : "listToolbar.compactRows",
            )}
            onClick={() => onDensityChange(density === "compact" ? "comfortable" : "compact")}
          >
            {density === "compact" ? <Rows3Icon /> : <Rows2Icon />}
          </Button>
        )}

        {columns?.length && isColumnVisible && onToggleColumn ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("listToolbar.toggleColumns")}
                  title={t("listToolbar.columns")}
                >
                  <SlidersHorizontalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("listToolbar.columns")}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={isColumnVisible(c.id)}
                  onCheckedChange={() => onToggleColumn(c.id)}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" disabled={exportDisabled}>
                  <DownloadIcon /> {t("listToolbar.export")}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onClick={() => onExport("csv")}>
                {t("listToolbar.downloadCsv")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("json")}>
                {t("listToolbar.downloadJson")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {children}
      </div>
    </search>
  );
}
