import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { ArrowRightIcon, EllipsisIcon, PencilIcon, PowerIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DirectoryMapping, MappingPreview } from "../api/directory";
import {
  DIRECTORY_PANEL,
  DirectorySearch,
  DirectorySelect,
  DirectorySkeletonRows,
  DirectoryStatus,
} from "./directory-ui";

/** The mapping rules table, with its own search, status filter and selection. */
export function MappingRulesTable({
  mappings,
  loading,
  canWrite,
  busy,
  preview,
  onEdit,
  onDelete,
  onToggle,
}: {
  mappings: DirectoryMapping[];
  loading: boolean;
  canWrite: boolean;
  busy: boolean;
  preview?: MappingPreview;
  onEdit: (mapping: DirectoryMapping) => void;
  onDelete: (mappings: DirectoryMapping[]) => void;
  onToggle: (mapping: DirectoryMapping) => void;
}) {
  const { t } = useTranslation("directory");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const visible = mappings.filter(
    (mapping) =>
      (!state || mapping.enabled === (state === "active")) &&
      `${mapping.source_attribute} ${mapping.target_field}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selectedMappings = mappings.filter((mapping) => selected.has(mapping.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className={DIRECTORY_PANEL} aria-label={t("directory.mappings.rules")}>
      <header className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 className="font-heading text-sm font-semibold">
          {t("directory.mappings.rules")}{" "}
          <span className="text-muted-foreground">({mappings.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <DirectorySearch
            label={t("directory.mappings.search")}
            value={search}
            onChange={setSearch}
          />
          <DirectorySelect
            label={t("directory.mappings.filter")}
            value={state}
            onChange={setState}
            options={[
              { value: "all", label: t("directory.allStatuses") },
              { value: "active", label: t("directory.mappings.activeLabel") },
              { value: "disabled", label: t("directory.mappings.disabled") },
            ]}
          />
        </div>
      </header>
      {canWrite && selectedMappings.length ? (
        <div className="flex items-center justify-between border-y border-border bg-primary/5 px-4 py-2 text-xs">
          <span>{t("directory.mappings.selected", { count: selectedMappings.length })}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onDelete(selectedMappings)}
          >
            <TrashIcon />
            {t("directory.mappings.delete")}
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <Table className="min-w-160 text-xs [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:text-[10px]">
          <TableHeader className="border-y border-border/60 bg-muted/25">
            <TableRow>
              {canWrite ? (
                <TableHead>
                  <input
                    type="checkbox"
                    aria-label={t("directory.mappings.selectAll")}
                    checked={
                      visible.length > 0 && visible.every((mapping) => selected.has(mapping.id))
                    }
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? new Set(visible.map((mapping) => mapping.id))
                          : new Set(),
                      )
                    }
                    className="size-3.5 accent-primary"
                  />
                </TableHead>
              ) : null}
              {(
                [
                  "source",
                  "target",
                  "type",
                  "transform",
                  "previewValue",
                  "status",
                  "actions",
                ] as const
              ).map((column) => (
                <TableHead key={column}>{t(`directory.mappings.${column}`)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <DirectorySkeletonRows colSpan={8} />
            ) : (
              visible.map((mapping) => (
                <TableRow key={mapping.id}>
                  {canWrite ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={t("directory.mappings.select", {
                          field: mapping.target_field,
                        })}
                        checked={selected.has(mapping.id)}
                        onChange={() => toggle(mapping.id)}
                        className="size-3.5 accent-primary"
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <code
                      className="block max-w-32 truncate rounded border border-border/60 bg-muted/20 px-2 py-1"
                      title={mapping.source_attribute}
                    >
                      {mapping.source_attribute}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
                      <code className="rounded border border-border/60 bg-muted/20 px-2 py-1">
                        {mapping.target_field}
                      </code>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      {t(`directory.mappings.types.${mapping.value_type}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p>{t(`directory.mappings.transformOptions.${mapping.transform}`)}</p>
                    {mapping.pattern ? (
                      <code
                        className="mt-1 block max-w-28 truncate text-[10px] text-muted-foreground"
                        title={mapping.pattern}
                      >
                        {mapping.pattern}
                      </code>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className="max-w-28 truncate"
                    title={JSON.stringify(preview?.values[mapping.id])}
                  >
                    {preview?.values[mapping.id] == null
                      ? "--"
                      : typeof preview.values[mapping.id] === "string"
                        ? String(preview.values[mapping.id])
                        : JSON.stringify(preview.values[mapping.id])}
                  </TableCell>
                  <TableCell>
                    <DirectoryStatus
                      label={t(
                        mapping.enabled
                          ? "directory.mappings.activeLabel"
                          : "directory.mappings.disabled",
                      )}
                      tone={mapping.enabled ? "success" : "neutral"}
                    />
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t("directory.mappings.rowActions", {
                                field: mapping.target_field,
                              })}
                              disabled={busy}
                            />
                          }
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(mapping)}>
                            <PencilIcon />
                            {t("directory.mappings.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggle(mapping)}>
                            <PowerIcon />
                            {t(
                              mapping.enabled
                                ? "directory.mappings.disable"
                                : "directory.mappings.enable",
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete([mapping])}>
                            <TrashIcon />
                            {t("directory.mappings.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      "--"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-muted-foreground">
                  {t(search || state ? "directory.noResults" : "directory.mappings.empty")}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
