import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Textarea,
} from "@qeetrix/ui";
import { CircleCheckIcon, CircleSlashIcon, CircleXIcon, LoaderCircleIcon } from "@qeetrix/icons";
import type { ParseKeys } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorText } from "@/platform/components/error-reference";
import { type ImportResult, type ImportRow, useImportGroups } from "../api/groups";

// Why a row wasn't created, by the server's code; an unknown code reads as its status.
const ROW_CODE_KEYS: Record<string, ParseKeys<"groups">> = {
  "group.import_name_required": "import.rowCodes.nameRequired",
  "group.import_name_exists": "import.rowCodes.nameExists",
  "group.import_parent_not_found": "import.rowCodes.parentNotFound",
};

function rowReasonKey(row: ImportResult["rows"][number]): ParseKeys<"groups"> {
  if (row.code && Object.hasOwn(ROW_CODE_KEYS, row.code)) {
    return ROW_CODE_KEYS[row.code] ?? "import.rowFailed";
  }
  return row.status === "skipped" ? "import.rowSkipped" : "import.rowFailed";
}

/**
 * Parses pasted `name, description, parent` lines into import rows. Only the first and last commas
 * split, so a description may contain commas without being truncated.
 */
export function parseImportRows(text: string): ImportRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const first = line.indexOf(",");
      if (first === -1) return { name: line };
      const rest = line.slice(first + 1);
      const last = rest.lastIndexOf(",");
      if (last === -1) return { name: line.slice(0, first).trim(), description: rest.trim() };
      return {
        name: line.slice(0, first).trim(),
        description: rest.slice(0, last).trim(),
        parent: rest.slice(last + 1).trim() || undefined,
      };
    });
}

export function ImportGroupsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("groups");
  const importM = useImportGroups();
  const [text, setText] = useState("");
  const result = importM.data;

  const close = (o: boolean) => {
    if (!o) {
      setText("");
      importM.reset();
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{result ? t("import.resultTitle") : t("import.title")}</DialogTitle>
          <DialogDescription>
            {result
              ? t("import.resultSummary", {
                  created: result.created,
                  skipped: result.skipped,
                  failed: result.failed,
                })
              : t("import.description")}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {result.rows.map((row) => (
              <li
                key={`${row.status}-${row.name}`}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                {row.status === "created" ? (
                  <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                ) : row.status === "skipped" ? (
                  <CircleSlashIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <span className="min-w-0">
                  <span className="font-medium">{row.name}</span>
                  {row.status !== "created" ? (
                    <span className="block text-xs text-muted-foreground">
                      {t(rowReasonKey(row))}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <form
            id="import-groups-form"
            onSubmit={(e) => {
              e.preventDefault();
              importM.mutate(parseImportRows(text));
            }}
          >
            <Field>
              <FieldLabel htmlFor="import_text" className="sr-only">
                {t("import.title")}
              </FieldLabel>
              <Textarea
                id="import_text"
                rows={8}
                required
                className="font-mono text-xs"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("import.placeholder")}
              />
              {importM.error ? (
                <FieldError>
                  <ErrorText error={importM.error} />
                </FieldError>
              ) : null}
            </Field>
          </form>
        )}

        <DialogFooter>
          {result ? (
            <DialogClose render={<Button type="button" />}>{t("import.done")}</DialogClose>
          ) : (
            <>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("import.cancel")}
              </DialogClose>
              <Button type="submit" form="import-groups-form" disabled={importM.isPending}>
                {importM.isPending ? <LoaderCircleIcon className="animate-spin" /> : null}
                {importM.isPending ? t("import.submitting") : t("import.submit")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
