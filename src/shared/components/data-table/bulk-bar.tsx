import { Button } from "@qeetrix/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type BulkBarProps = {
  count: number;
  progress?: { done: number; total: number } | null; // live progress of a long fan-out
  disabled?: boolean;
  onClear: () => void;
  children: ReactNode; // the bulk actions, on the right
};

/** Renders the strip between a card header and its table while rows are selected. */
export function BulkBar({ count, progress, disabled, onClear, children }: BulkBarProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-wrap items-center gap-2 border-y border-primary/20 bg-primary/6 px-4 py-2.5 text-sm shadow-[inset_3px_0_0_var(--primary)]">
      <span className="font-semibold tabular-nums">{t("bulkBar.selected", { count })}</span>
      {progress && (
        // No toast comes until the bulk action settles, so a live region voices each step.
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("bulkBar.progress", { done: progress.done, total: progress.total })}
        </span>
      )}
      <Button variant="ghost" size="sm" className="ms-auto" onClick={onClear} disabled={disabled}>
        {t("bulkBar.clear")}
      </Button>
      {children}
    </div>
  );
}
