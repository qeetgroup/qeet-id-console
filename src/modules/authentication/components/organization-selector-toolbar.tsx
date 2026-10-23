import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import { LayoutGridIcon, ListIcon, SearchIcon, XIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { OrganizationSort } from "../organization-selection-model";

export type OrganizationLayout = "grid" | "list";

/** Renders the search, role filter, sort and grid/list switch above the organization list. */
export function OrganizationSelectorToolbar({
  search,
  onSearchChange,
  onSearchClear,
  role,
  roles,
  roleLabel,
  onRoleChange,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
  disabled,
  filtersDisabled,
}: {
  search: string;
  onSearchChange: (search: string) => void;
  onSearchClear: () => void;
  role: string;
  roles: string[];
  roleLabel: (name: string) => string;
  onRoleChange: (role: string) => void;
  sort: OrganizationSort;
  onSortChange: (sort: OrganizationSort) => void;
  layout: OrganizationLayout;
  onLayoutChange: (layout: OrganizationLayout) => void;
  disabled: boolean;
  /** Also set while the list is loading or failed, when there is nothing to filter. */
  filtersDisabled: boolean;
}) {
  const { t } = useTranslation("auth-flow");
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <SearchIcon
          className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label={t("organizationSelection.search")}
          placeholder={t("organizationSelection.searchPlaceholder")}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          disabled={filtersDisabled}
          className="h-10 rounded-md bg-card/75 ps-10 pe-9 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base [&::-webkit-search-cancel-button]:appearance-none"
        />
        {search && (
          <button
            type="button"
            aria-label={t("organizationSelection.clearSearch")}
            title={t("organizationSelection.clearSearch")}
            onClick={onSearchClear}
            disabled={disabled}
            className="absolute inset-e-1 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      <Select
        value={role ? `role:${role}` : "all"}
        onValueChange={(value) => onRoleChange(value?.startsWith("role:") ? value.slice(5) : "")}
        disabled={filtersDisabled}
      >
        <SelectTrigger
          aria-label={t("organizationSelection.roleFilter")}
          className="h-10 w-32 rounded-md bg-card/75 text-xs pointer-coarse:min-h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("organizationSelection.allRoles")}</SelectItem>
          {roles.map((name) => (
            <SelectItem key={name} value={`role:${name}`}>
              {roleLabel(name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={sort}
        onValueChange={(value) => {
          if (value === "recent" || value === "name" || value === "name-desc") onSortChange(value);
        }}
        disabled={filtersDisabled}
      >
        <SelectTrigger
          aria-label={t("organizationSelection.sort")}
          className="h-10 w-39 rounded-md bg-card/75 text-xs pointer-coarse:min-h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["recent", "name", "name-desc"] as const).map((value) => (
            <SelectItem key={value} value={value}>
              {t(`organizationSelection.sorts.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <fieldset
        aria-label={t("organizationSelection.layout")}
        className="inline-flex h-10 items-center gap-0.5 rounded-md border border-border/70 bg-card/65 p-0.5 pointer-coarse:h-12"
      >
        {(["grid", "list"] as const).map((value) => {
          const Icon = value === "grid" ? LayoutGridIcon : ListIcon;
          return (
            <Tooltip key={value}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={t(`organizationSelection.${value}View`)}
                    aria-pressed={layout === value}
                    disabled={disabled}
                    onClick={() => onLayoutChange(value)}
                    className={cn(
                      "grid size-8 cursor-pointer place-items-center rounded transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:size-10",
                      layout === value
                        ? "bg-muted text-foreground shadow-xs ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  />
                }
              >
                <Icon className="size-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{t(`organizationSelection.${value}View`)}</TooltipContent>
            </Tooltip>
          );
        })}
      </fieldset>
    </div>
  );
}
