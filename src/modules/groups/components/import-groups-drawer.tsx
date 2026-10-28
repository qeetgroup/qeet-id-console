import { DownloadIcon, UploadIcon } from "@qeetrix/icons";
import {
  Badge,
  type BadgeTone,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  formatNumber,
  Link,
  Table,
  type TableColumn,
  Text,
  Textarea,
} from "@qeetrix/react";
import { Alert, FileUpload, Steps } from "@qeetrix/react/experimental";
import type { ParseKeys } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { type Group, type ImportResult, useImportGroups } from "@/modules/groups/api/groups";
import {
  checkImport,
  type ImportLine,
  type ImportOutcome,
  importLines,
  SAMPLE_ROWS,
} from "@/modules/groups/groups-io-model";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { exportToCsv } from "@/shared/utils/data-export";
import "./group-templates-drawer.css";
import "./import-groups-drawer.css";

const MAX_BYTES = 1_000_000;
type Step = "choose" | "check" | "done";
type Checked = ImportLine & { outcome: ImportOutcome };
type Result = ImportResult["rows"][number];

const TONE: Record<ImportOutcome, BadgeTone> = {
  new: "success",
  exists: "neutral",
  repeated: "danger",
  parent: "danger",
  unnamed: "danger",
};
// Why the server didn't make a row, by its code; an unknown one reads as its status.
const RESULT_KEYS: Record<string, ParseKeys<"groups">> = {
  "group.import_name_required": "importDrawer.outcomes.unnamed",
  "group.import_name_exists": "importDrawer.outcomes.exists",
  "group.import_parent_not_found": "importDrawer.outcomes.parent",
};

/**
 * Import groups, in three steps: a CSV file (or the rows pasted), every row checked against the
 * groups and the file itself before anything is made, then what the server made and what it
 * didn't, with why. Rows are matched to their parent by name, so a row may sit inside another.
 */
export function ImportGroupsDrawer({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly Group[];
}) {
  const { t } = useTranslation("groups");
  const n = (value: number) => formatNumber(value, formatLocale());
  const importM = useImportGroups();
  const [step, setStep] = useState<Step>("choose");
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [readError, setReadError] = useState<string>();
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setPasting(false);
    setText("");
    setFile(null);
    setReadError(undefined);
    setResult(null);
    importM.reset();
  }, [open, importM.reset]);

  const lines = importLines(text);
  const checked: Checked[] = checkImport(lines, groups);
  const count = (o: ImportOutcome) => checked.filter((r) => r.outcome === o).length;
  const fresh = checked.filter((r) => r.outcome === "new");
  const problems = count("parent") + count("unnamed") + count("repeated");

  const read = async (files: File[]) => {
    const chosen = files[0];
    if (!chosen) return;
    setReadError(undefined);
    try {
      setText(await chosen.text());
      setFile({ name: chosen.name, size: chosen.size });
    } catch {
      setReadError(t("importDrawer.unreadable"));
    }
  };
  const send = () =>
    importM.mutate(
      fresh.map(({ name, parent, description }) => ({ name, parent, description })),
      {
        onSuccess: (res) => {
          setResult(res);
          setStep("done");
        },
      },
    );

  const columns: TableColumn<Checked>[] = [
    { id: "line", header: t("importDrawer.row"), numeric: true, width: 64, cell: (r) => r.line },
    {
      id: "group",
      header: t("importDrawer.group"),
      primary: true,
      cell: (r) => (
        <span className="grp-imp-two">
          {r.name ? r.name : <Text tone="subtle">{t("importDrawer.noName")}</Text>}
          <small>
            {r.parent
              ? groups.some((g) => g.name.trim().toLowerCase() === r.parent?.trim().toLowerCase())
                ? t("importDrawer.inside", { parent: r.parent })
                : t("importDrawer.insideFromFile", { parent: r.parent })
              : t("importDrawer.atTheTop")}
          </small>
        </span>
      ),
    },
    {
      id: "outcome",
      header: t("importDrawer.willHappen"),
      width: 280,
      cell: (r) => (
        <span className="grp-imp-two">
          <Badge tone={TONE[r.outcome]} size="sm">
            {t(`importDrawer.outcomes.${r.outcome}`)}
          </Badge>
          {r.outcome === "exists" || r.outcome === "repeated" || r.outcome === "parent" ? (
            <small>{t(`importDrawer.why.${r.outcome}`, { parent: r.parent ?? "" })}</small>
          ) : null}
        </span>
      ),
    },
  ];
  const resultColumns: TableColumn<Result & { line: number }>[] = [
    { id: "line", header: t("importDrawer.row"), numeric: true, width: 64, cell: (r) => r.line },
    {
      id: "group",
      header: t("importDrawer.group"),
      primary: true,
      cell: (r) => r.name || <Text tone="subtle">{t("importDrawer.noName")}</Text>,
    },
    {
      id: "outcome",
      header: t("importDrawer.happened"),
      width: 280,
      cell: (r) => (
        <Badge tone={r.status === "skipped" ? "neutral" : "danger"} size="sm">
          {r.code && RESULT_KEYS[r.code]
            ? t(RESULT_KEYS[r.code] as "importDrawer.outcomes.exists")
            : r.status === "skipped"
              ? t("importDrawer.skipped")
              : t("importDrawer.notMade")}
        </Badge>
      ),
    },
  ];
  // The server's rows follow the ones sent, which are the new ones, in order.
  const notMade = (result?.rows ?? [])
    .map((r, i) => ({ ...r, line: fresh[i]?.line ?? i + 1 }))
    .filter((r) => r.status !== "created");
  const skippedHere = checked.filter((r) => r.outcome !== "new");

  return (
    <Drawer open={open} onOpenChange={(next) => (!importM.isPending || next) && onOpenChange(next)}>
      <DrawerContent
        title={t("importDrawer.title")}
        description={t("importDrawer.description")}
        size="lg"
      >
        <DrawerBody>
          <div className="sub-form">
            <Steps
              steps={[
                { label: t("importDrawer.steps.choose") },
                { label: t("importDrawer.steps.check") },
                { label: t("importDrawer.steps.done") },
              ]}
              current={step === "choose" ? 0 : step === "check" ? 1 : 3}
            />
            {step === "choose" ? (
              <>
                {pasting ? (
                  <Field label={t("importDrawer.rows")} description={t("importDrawer.rowsHelp")}>
                    <Textarea
                      className="grp-tpl-outline"
                      rows={8}
                      maxRows={16}
                      value={text}
                      onValueChange={setText}
                      placeholder={t("importDrawer.rowsPlaceholder")}
                    />
                  </Field>
                ) : (
                  <Field
                    label={t("importDrawer.file")}
                    description={t("importDrawer.fileHelp")}
                    error={readError}
                  >
                    <FileUpload
                      accept=".csv,text/csv"
                      maxSize={MAX_BYTES}
                      onSelect={(files) => void read(files)}
                      items={file ? [{ id: "file", name: file.name, size: file.size }] : undefined}
                      onRemove={() => {
                        setFile(null);
                        setText("");
                      }}
                    />
                  </Field>
                )}
                <p className="grp-imp-links">
                  <Link
                    render={
                      <button
                        type="button"
                        onClick={() =>
                          exportToCsv("groups-sample", SAMPLE_ROWS, [
                            { header: "name", value: (r) => r.name },
                            { header: "parent", value: (r) => r.parent },
                            { header: "description", value: (r) => r.description },
                          ])
                        }
                      />
                    }
                  >
                    <DownloadIcon className="add-import-icon" aria-hidden="true" />
                    {t("importDrawer.sample")}
                  </Link>
                  <Link render={<button type="button" onClick={() => setPasting(!pasting)} />}>
                    {pasting ? t("importDrawer.useFile") : t("importDrawer.paste")}
                  </Link>
                </p>
              </>
            ) : null}
            {step === "check" ? (
              <>
                <Alert
                  tone={problems ? "warning" : "info"}
                  title={t("importDrawer.checkSummary", {
                    source: file?.name ?? t("importDrawer.pasted"),
                    rows: n(checked.length),
                    fresh: n(fresh.length),
                    exists: n(count("exists")),
                    problems: n(problems),
                  })}
                >
                  {t("importDrawer.checkHint")}
                </Alert>
                {importM.isError ? (
                  <>
                    <Alert tone="danger" title={errorMessage(importM.error)} />
                    <ErrorReference error={importM.error} />
                  </>
                ) : null}
                <Table<Checked>
                  label={t("importDrawer.rowsTable")}
                  rows={checked}
                  rowId={(r) => String(r.line)}
                  rowLabel={(r) => r.name || t("importDrawer.rowN", { n: r.line })}
                  columns={columns}
                />
              </>
            ) : null}
            {step === "done" && result ? (
              <>
                <Alert
                  tone={result.failed ? "warning" : "success"}
                  title={t("importDrawer.doneSummary", {
                    made: n(result.created),
                    skipped: n(result.skipped + count("exists")),
                    failed: n(result.failed + problems),
                  })}
                >
                  {t("importDrawer.doneHint")}
                </Alert>
                {notMade.length || skippedHere.length ? (
                  <Table<Result & { line: number }>
                    label={t("importDrawer.notMadeTable")}
                    rows={[
                      ...skippedHere.map((r) => ({
                        line: r.line,
                        name: r.name,
                        status: r.outcome === "exists" ? ("skipped" as const) : ("failed" as const),
                        code:
                          r.outcome === "exists"
                            ? "group.import_name_exists"
                            : r.outcome === "parent"
                              ? "group.import_parent_not_found"
                              : r.outcome === "unnamed"
                                ? "group.import_name_required"
                                : undefined,
                      })),
                      ...notMade,
                    ].sort((a, b) => a.line - b.line)}
                    rowId={(r) => `${r.line}-${r.name}`}
                    rowLabel={(r) => r.name || t("importDrawer.rowN", { n: r.line })}
                    columns={resultColumns}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </DrawerBody>
        <DrawerFooter>
          {step === "done" ? (
            <Button onClick={() => onOpenChange(false)}>{t("importDrawer.finish")}</Button>
          ) : step === "check" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep("choose")}
                disabled={importM.isPending}
              >
                {t("importDrawer.back")}
              </Button>
              <Button
                icon={UploadIcon}
                loading={importM.isPending}
                disabled={!fresh.length}
                onClick={send}
              >
                {t("importDrawer.importN", { count: fresh.length, n: n(fresh.length) })}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("importDrawer.cancel")}
              </Button>
              <Button disabled={!lines.length} onClick={() => setStep("check")}>
                {t("importDrawer.checkRows")}
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
