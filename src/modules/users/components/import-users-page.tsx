import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CloudUploadIcon,
  FileUpIcon,
  LoaderCircleIcon,
  XIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { StatusPill } from "@/platform/components/status-pill";
import { FormError } from "@/platform/forms/app-form";

import { type BulkImportResult, useBulkImportUsers } from "../api/users";
import { importRowErrorMessage } from "../import-errors";
import { type ImportRow, MAX_IMPORT_ROWS, parseImportFile } from "../import-file";

/** Renders the bulk import: pick a CSV or NDJSON file, preview its rows, import, see the result. */
export function ImportUsersPage() {
  const { t } = useTranslation("users");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const importM = useBulkImportUsers();
  const validRows = rows?.filter((r) => !r.error) ?? [];
  const invalidRows = rows?.filter((r) => !!r.error) ?? [];
  const tooMany = validRows.length > MAX_IMPORT_ROWS;

  async function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    setRows(parseImportFile(file.name, await file.text()));
  }

  function reset() {
    setRows(null);
    setFileName(null);
    setResult(null);
    importM.reset();
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("import.description")}
        actions={
          <Link to="/users" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeftIcon /> {t("import.backLink")}
          </Link>
        }
      />

      {/* File picker */}
      {!rows && (
        <Card>
          <CardContent
            className="p-0"
            // Drag-and-drop enhances the real file input below; the wrapper takes the drop
            // handlers so the <label> stays a pure label.
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <label
              htmlFor="user-import-file"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-12 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
              )}
            >
              <CloudUploadIcon className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">{t("import.dropTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("import.dropHelp")}</p>
              <input
                id="user-import-file"
                type="file"
                accept=".csv,.ndjson,.jsonl,text/csv,application/x-ndjson"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {rows && !result && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {t("import.previewTitle")} <span className="text-muted-foreground">{fileName}</span>
              </CardTitle>
              <CardDescription>
                {t("import.validRows", { count: validRows.length })}
                {invalidRows.length > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">
                    {" "}
                    {t("import.skippedRows", { count: invalidRows.length })}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                <XIcon /> {t("import.cancelBtn")}
              </Button>
              <Button
                size="sm"
                disabled={validRows.length === 0 || tooMany || importM.isPending}
                onClick={() => importM.mutate(validRows, { onSuccess: setResult })}
              >
                {importM.isPending ? <LoaderCircleIcon className="animate-spin" /> : <FileUpIcon />}
                {t("import.importBtn", { count: validRows.length })}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {tooMany && (
              <p className="border-b p-3 text-sm text-destructive">
                {t("import.tooMany", { max: MAX_IMPORT_ROWS.toLocaleString(formatLocale()) })}
              </p>
            )}
            {importM.error ? (
              <div className="border-b p-3">
                <FormError error={importM.error} />
              </div>
            ) : null}
            <DataState
              isLoading={false}
              isEmpty={(rows?.length ?? 0) === 0}
              emptyTitle={t("import.previewEmpty")}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">{t("import.colLine")}</TableHead>
                    <TableHead>{t("import.colEmail")}</TableHead>
                    <TableHead>{t("import.colName")}</TableHead>
                    <TableHead>{t("import.colPhone")}</TableHead>
                    <TableHead>{t("import.colPassword")}</TableHead>
                    <TableHead className="text-right">{t("import.colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="text-muted-foreground">{r.line}</TableCell>
                      <TableCell className="font-mono text-xs">{r.email || "—"}</TableCell>
                      <TableCell>{r.display_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.password ? "•••••" : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.error ? (
                          <StatusPill kind="danger">{importRowErrorMessage(r.error)}</StatusPill>
                        ) : (
                          <StatusPill status="ok" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataState>
            {rows.length > 100 && (
              <div className="border-t p-2 text-center text-xs text-muted-foreground">
                {t("import.showingFirst", { total: rows.length })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("import.resultTitle")}</CardTitle>
            <CardDescription>
              {t("import.resultSucceeded", { count: result.succeeded })}
              {result.failed > 0 && (
                <span className="text-rose-600 dark:text-rose-400">
                  {" · "}
                  {t("import.resultFailed", { count: result.failed })}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          {result.errors && result.errors.length > 0 && (
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("import.errorColLine")}</TableHead>
                    <TableHead>{t("import.errorColEmail")}</TableHead>
                    <TableHead>{t("import.errorColError")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((e, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: no id; never reordered
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{e.line ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{e.email ?? "—"}</TableCell>
                      <TableCell className="text-rose-600 dark:text-rose-400">
                        {importRowErrorMessage(e)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                {t("import.importAnotherBtn")}
              </Button>
              <Link to="/users" className={buttonVariants({ size: "sm" })}>
                {t("import.viewUsersBtn")}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
