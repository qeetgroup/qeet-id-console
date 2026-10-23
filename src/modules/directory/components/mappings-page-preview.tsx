import { Button, cn, Field, FieldLabel, Textarea } from "@qeetrix/ui";
import { ArrowDownIcon, PlayIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";

import type { MappingPreview } from "../api/directory";
import { DIRECTORY_ACTION, DIRECTORY_PANEL } from "./directory-ui";

// A code newer than this console reads as a generic problem rather than a humanised key.
function issueKey(code: string): string {
  const key = `directory.mappings.issues.${code.replace(/^directory\.mapping_/, "")}`;
  return i18n.exists(key, { ns: "dashboard" }) ? key : "directory.mappings.issues.unknown";
}

/** Test data for the active rules, the profile they map it to, and the issues found. */
export function MappingPreviewPanel({
  source,
  onSourceChange,
  preview,
  onPreview,
  previewing,
  hasActiveRules,
}: {
  source: string;
  onSourceChange: (source: string) => void;
  preview?: MappingPreview;
  onPreview: () => void;
  previewing: boolean;
  hasActiveRules: boolean;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <aside className={cn(DIRECTORY_PANEL, "p-4")} aria-label={t("directory.mappings.preview")}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">{t("directory.mappings.preview")}</h2>
        <Button
          variant="outline"
          className={DIRECTORY_ACTION}
          onClick={onPreview}
          disabled={previewing || !hasActiveRules}
        >
          <PlayIcon />
          {t("directory.mappings.testData")}
        </Button>
      </header>
      <Field>
        <FieldLabel htmlFor="directory-mapping-source" className="text-xs">
          {t("directory.mappings.sourceData")}
        </FieldLabel>
        <Textarea
          id="directory-mapping-source"
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
          maxLength={64000}
          spellCheck={false}
          className="min-h-44 resize-y bg-muted/20 font-mono text-[11px] leading-5"
        />
      </Field>
      <ArrowDownIcon className="mx-auto my-3 size-5 text-muted-foreground" aria-hidden="true" />
      <div className="rounded-md border border-border/60 bg-muted/20 p-3">
        <h3 className="mb-2 text-xs font-medium">{t("directory.mappings.mappedProfile")}</h3>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap wrap-anywhere font-mono text-[11px] leading-5">
          {JSON.stringify(preview?.profile ?? {}, null, 2)}
        </pre>
      </div>
      <div
        className={cn(
          "mt-3 rounded-md p-3 text-xs",
          !preview
            ? "bg-muted/40 text-muted-foreground"
            : preview.valid
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        )}
        role="status"
      >
        <p className="font-medium">
          {t(
            !preview
              ? "directory.mappings.notValidated"
              : preview.valid
                ? "directory.mappings.valid"
                : "directory.mappings.review",
          )}
        </p>
        {preview?.issues.map((issue) => (
          <p key={`${issue.mapping_id}:${issue.field}:${issue.code}`} className="mt-1 text-[11px]">
            {issue.field &&
              `${t(`directory.mappings.targets.${issue.field}`, { defaultValue: issue.field })}: `}
            {t(issueKey(issue.code))}
          </p>
        ))}
      </div>
    </aside>
  );
}
