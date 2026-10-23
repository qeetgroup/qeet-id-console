// Activity and audit investigation: the live SSE feed plus the audit history. All filter, time,
// mode, view and selection state lives in the URL, so any view can be shared by pasting it.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import { DownloadIcon, type IconProps, LoaderCircleIcon } from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { type ActivitySearch, arrayToCsv } from "../activity-search";
import type { ActivityFilters, Outcome } from "@/modules/activity";
import { ACTIVITY_CATEGORIES } from "../event-labels";

// Labelled `activity:category.<value>` and `activity:outcome.<value>`.
export const CATEGORIES = ACTIVITY_CATEGORIES;
export const OUTCOMES: Outcome[] = ["success", "warning", "failed", "info"];

export function prettify(v: string): string {
  if (v.includes(".")) return v;
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/[_-]/g, " ");
}

// Time (from/to) is left out: the range control owns it.
export function filtersPatchToSearch(patch: Partial<ActivityFilters>): Partial<ActivitySearch> {
  const s: Partial<ActivitySearch> = {};
  if (patch.types !== undefined) s.type = arrayToCsv(patch.types);
  if (patch.severity !== undefined) s.severity = arrayToCsv(patch.severity);
  if (patch.category !== undefined) s.category = arrayToCsv(patch.category);
  if (patch.actor !== undefined) s.actor = patch.actor || undefined;
  if (patch.source !== undefined) s.source = patch.source || undefined;
  if (patch.status !== undefined) s.status = patch.status || undefined;
  if (patch.ip !== undefined) s.ip = patch.ip || undefined;
  if (patch.resource !== undefined) s.resource = patch.resource || undefined;
  if (patch.q !== undefined) s.q = patch.q || undefined;
  return s;
}

export function FacetSelect({
  label,
  value,
  onChange,
  options,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  icon: ComponentType<IconProps<"outline">>;
}) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : (v ?? ""))}>
      <SelectTrigger className="w-40 gap-2" aria-label={label}>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExportMenu({
  exporting,
  onExport,
}: {
  exporting: "csv" | "json" | "ndjson" | null;
  onExport: (f: "csv" | "json" | "ndjson") => void;
}) {
  const { t } = useTranslation("activity");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={!!exporting}>
            {exporting ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <DownloadIcon className="size-3.5" aria-hidden="true" />
            )}
            {exporting
              ? t("export.running", { format: exporting.toUpperCase() })
              : t("export.button")}
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-36">
        <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("json")}>JSON</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("ndjson")}>NDJSON</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
