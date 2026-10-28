import { DownloadIcon, RotateCcwIcon, UploadIcon, UsersIcon } from "@qeetrix/icons";
import { Badge, Button, Field, formatNumber, Table, type TableColumn, Text } from "@qeetrix/react";
import { Alert, FileUpload, PageContent, PageHeader, Steps } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useOrgs } from "@/modules/organizations";
import {
  type BulkImportResult,
  useBulkImportUsers,
  useUserDirectory,
} from "@/modules/users/api/users";
import { importRowErrorMessage, type ImportRowError } from "@/modules/users/import-errors";
import {
  type CheckedRow,
  checkImportRows,
  IMPORT_TEMPLATE,
  type ImportProblem,
  type ImportRow,
  MAX_IMPORT_ROWS,
  parseImportFile,
} from "@/modules/users/import-file";
import { useTenantId } from "@/platform/auth/session";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { exportToCsv } from "@/shared/utils/data-export";
import "../person/person.css";
import "./import.css";

/** The server's limit on an import file (internal/identity/users/bulk.go: maxImportBytes). */
const MAX_BYTES = 10 * 1024 * 1024;
const COLUMNS = ["email", "display_name", "phone", "password"] as const;

type Step = "choose" | "check" | "done";
type NotImported = { line: number; email: string; name?: string; why: string };

/**
 * Import people from a file, in three steps: choose a CSV or NDJSON file (its columns explained,
 * with a template), check every row before anything is sent (rows to fix are named and left out),
 * and see what happened (what wasn't imported, and why). Everyone joins the organisation you're
 * in, with no role yet: the bulk endpoint takes none.
 */
export function ImportUsersPage() {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((item) => item.id === tenantId)?.name;
  const directory = useUserDirectory();
  const importM = useBulkImportUsers();
  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ImportRow[]>([]);
  const [readError, setReadError] = useState<string>();
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const members = useMemo(
    () => new Set((directory.data?.items ?? []).map((u) => u.email.toLowerCase())),
    [directory.data],
  );
  // Checked against the organisation as it loads, so a row already here is caught either way.
  const rows = useMemo(() => checkImportRows(parsed, members), [parsed, members]);
  const ready = rows.filter((r) => !r.problem);
  const toFix = rows.filter((r) => !!r.problem);
  const tooMany = ready.length > MAX_IMPORT_ROWS;

  const read = async (files: File[]) => {
    const chosen = files[0];
    if (!chosen) return;
    setReadError(undefined);
    try {
      const rows = parseImportFile(chosen.name, await chosen.text());
      if (!rows.length) {
        setReadError(t("importPage.emptyFile"));
        return;
      }
      setFile(chosen);
      setParsed(rows);
      setStep("check");
    } catch {
      setReadError(t("importPage.unreadable"));
    }
  };

  const reset = () => {
    setStep("choose");
    setFile(null);
    setParsed([]);
    setResult(null);
    importM.reset();
  };

  const send = () =>
    importM.mutate(ready, {
      onSuccess: (res) => {
        setResult(res);
        setStep("done");
      },
    });

  const problemText = (problem: ImportProblem, row: CheckedRow) =>
    problem === "parse" && row.error
      ? importRowErrorMessage(row.error)
      : t(`importPage.problems.${problem}`);

  const checkColumns: TableColumn<CheckedRow>[] = [
    { id: "line", header: t("importPage.line"), numeric: true, width: 64, cell: (r) => r.line },
    {
      id: "email",
      header: t("importPage.email"),
      primary: true,
      cell: (r) => r.email || <Text tone="subtle">—</Text>,
    },
    { id: "name", header: t("importPage.name"), cell: (r) => r.display_name || "—" },
    { id: "phone", header: t("importPage.phone"), width: 160, cell: (r) => r.phone || "—" },
    {
      id: "password",
      header: t("importPage.password"),
      width: 110,
      cell: (r) => (r.password ? t("importPage.passwordSet") : "—"),
    },
    {
      id: "check",
      header: t("importPage.check"),
      width: 220,
      cell: (r) =>
        r.problem ? (
          <Badge tone="danger" size="sm">
            {problemText(r.problem, r)}
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            {t("importPage.ready")}
          </Badge>
        ),
    },
  ];

  // What wasn't imported: the rows left out here, then those the server refused, by file line.
  const notImported: NotImported[] = [
    ...toFix.map((r) => ({
      line: r.line,
      email: r.email,
      name: r.display_name,
      why: r.problem ? problemText(r.problem, r) : "",
    })),
    ...(result?.errors ?? []).map((e: ImportRowError) => {
      const row = rows.find((r) => r.line === e.line);
      return {
        line: e.line ?? 0,
        email: e.email ?? row?.email ?? "",
        name: row?.display_name,
        why: importRowErrorMessage(e),
      };
    }),
  ].sort((a, b) => a.line - b.line);

  const notImportedColumns: TableColumn<NotImported>[] = [
    {
      id: "line",
      header: t("importPage.line"),
      numeric: true,
      width: 64,
      cell: (r) => r.line || "—",
    },
    {
      id: "row",
      header: t("importPage.row"),
      primary: true,
      cell: (r) => (
        <span className="prs-row-text">
          <span>{r.name || r.email || "—"}</span>
          {r.name && r.email ? <small>{r.email}</small> : null}
        </span>
      ),
    },
    { id: "why", header: t("importPage.why"), cell: (r) => r.why },
  ];

  const here = org ?? t("person.thisOrg");

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("importPage.title")}
        description={t("importPage.description", { n: n(MAX_IMPORT_ROWS) })}
      />
      <PageContent>
        <div className="prs-page imp-page">
          <div className="prs-section">
            <Steps
              steps={[
                { label: t("importPage.steps.choose") },
                { label: t("importPage.steps.check") },
                { label: t("importPage.steps.import") },
              ]}
              current={step === "choose" ? 0 : step === "check" ? 1 : 3}
            />
          </div>

          {step === "choose" ? (
            <>
              <section className="prs-section" aria-labelledby="imp-file">
                <h2 id="imp-file" className="prs-title">
                  {t("importPage.file")}
                </h2>
                <Field
                  label={t("importPage.fileLabel")}
                  description={t("importPage.fileHelp", { org: here })}
                  error={readError}
                >
                  <FileUpload
                    accept=".csv,.ndjson,.jsonl,text/csv,application/x-ndjson"
                    maxSize={MAX_BYTES}
                    hint={t("importPage.fileHint", { n: n(MAX_IMPORT_ROWS) })}
                    onSelect={(files) => void read(files)}
                    items={file ? [{ id: "file", name: file.name, size: file.size }] : undefined}
                    onRemove={reset}
                  />
                </Field>
              </section>
              <section className="prs-section" aria-labelledby="imp-columns">
                <div className="prs-head">
                  <div className="prs-head-text">
                    <h2 id="imp-columns" className="prs-title">
                      {t("importPage.columns")}
                    </h2>
                    <p className="prs-note">{t("importPage.columnsNote")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={DownloadIcon}
                    onClick={() =>
                      exportToCsv(
                        "people-template",
                        IMPORT_TEMPLATE,
                        COLUMNS.map((c) => ({ header: c, value: (r) => r[c] })),
                      )
                    }
                  >
                    {t("importPage.template")}
                  </Button>
                </div>
                <Table<(typeof COLUMNS)[number]>
                  label={t("importPage.columns")}
                  rows={COLUMNS}
                  rowId={(c) => c}
                  rowLabel={(c) => c}
                  columns={[
                    {
                      id: "column",
                      header: t("importPage.column"),
                      primary: true,
                      width: 180,
                      cell: (c) => <span className="prs-mono">{c}</span>,
                    },
                    {
                      id: "needed",
                      header: t("importPage.needed"),
                      width: 130,
                      cell: (c) =>
                        c === "email" ? (
                          <Badge tone="warning" size="sm">
                            {t("importPage.required")}
                          </Badge>
                        ) : (
                          t("importPage.optional")
                        ),
                    },
                    {
                      id: "holds",
                      header: t("importPage.holds"),
                      cell: (c) => t(`importPage.what.${c}`),
                    },
                  ]}
                />
                <p className="prs-note">{t("importPage.noRole")}</p>
              </section>
            </>
          ) : null}

          {step === "check" ? (
            <section className="prs-section" aria-labelledby="imp-check">
              <div className="prs-head">
                <div className="prs-head-text">
                  <h2 id="imp-check" className="prs-title">
                    {file?.name}
                  </h2>
                  <p className="prs-note">
                    {t("importPage.checkSummary", {
                      count: rows.length,
                      n: n(rows.length),
                      ready: n(ready.length),
                      fix: n(toFix.length),
                    })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" icon={RotateCcwIcon} onClick={reset}>
                  {t("importPage.another")}
                </Button>
              </div>
              {tooMany ? (
                <Alert
                  tone="danger"
                  title={t("importPage.tooManyTitle", { n: n(MAX_IMPORT_ROWS) })}
                >
                  {t("importPage.tooMany")}
                </Alert>
              ) : toFix.length ? (
                <Alert
                  tone="warning"
                  title={t("importPage.toFixTitle", { count: toFix.length, n: n(toFix.length) })}
                >
                  {t("importPage.toFix", { count: ready.length, n: n(ready.length) })}
                </Alert>
              ) : null}
              {importM.isError ? (
                <>
                  <Alert tone="danger" title={errorMessage(importM.error)} />
                  <ErrorReference error={importM.error} />
                </>
              ) : null}
              <Table<CheckedRow>
                label={t("importPage.rowsTable")}
                rows={rows}
                rowId={(r) => String(r.line)}
                rowLabel={(r) => r.email || t("importPage.lineN", { n: r.line })}
                columns={checkColumns}
              />
              <div className="imp-actions">
                <Button variant="ghost" onClick={reset} disabled={importM.isPending}>
                  {t("importPage.back")}
                </Button>
                <Button
                  icon={UploadIcon}
                  disabled={!ready.length || tooMany}
                  loading={importM.isPending}
                  onClick={send}
                >
                  {t("importPage.importN", { count: ready.length, n: n(ready.length) })}
                </Button>
              </div>
            </section>
          ) : null}

          {step === "done" && result ? (
            <section className="prs-section" aria-labelledby="imp-done">
              <h2 id="imp-done" className="prs-title">
                {t("importPage.doneHeading")}
              </h2>
              <Alert
                tone={result.succeeded ? (notImported.length ? "warning" : "success") : "danger"}
                title={t("importPage.added", {
                  count: result.succeeded,
                  n: n(result.succeeded),
                  org: here,
                })}
              >
                {[
                  result.succeeded ? t("importPage.addedNote") : null,
                  notImported.length
                    ? t("importPage.notImportedNote", {
                        count: notImported.length,
                        n: n(notImported.length),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </Alert>
              {notImported.length ? (
                <>
                  <div className="prs-head">
                    <h3 className="prs-title">
                      {t("importPage.notImported")}
                      <span className="prs-count">{n(notImported.length)}</span>
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={DownloadIcon}
                      onClick={() =>
                        exportToCsv("people-not-imported", notImported, [
                          { header: "line", value: (r) => String(r.line) },
                          { header: "email", value: (r) => r.email },
                          { header: "display_name", value: (r) => r.name ?? "" },
                          { header: "why", value: (r) => r.why },
                        ])
                      }
                    >
                      {t("importPage.downloadRows")}
                    </Button>
                  </div>
                  <Table<NotImported>
                    label={t("importPage.notImported")}
                    rows={notImported}
                    rowId={(r) => `${r.line}-${r.email}`}
                    rowLabel={(r) => r.name || r.email || t("importPage.lineN", { n: r.line })}
                    columns={notImportedColumns}
                  />
                </>
              ) : null}
              <div className="imp-actions">
                <Button variant="ghost" icon={RotateCcwIcon} onClick={reset}>
                  {t("importPage.another")}
                </Button>
                <Button icon={UsersIcon} render={<RouterLink to="/users" />}>
                  {t("importPage.viewUsers")}
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
