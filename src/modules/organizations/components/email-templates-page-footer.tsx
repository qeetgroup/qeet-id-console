import { Button, cn } from "@qeetrix/ui";
import {
  CircleCheckIcon,
  GlobeIcon,
  LoaderCircleIcon,
  MailIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

/** Who the emails come from, how many languages the template has, and who a test reaches. */
export function EmailSummaryCards({ brandName, locales }: { brandName: string; locales: number }) {
  const { t } = useTranslation("organizations");
  return (
    <div className="grid gap-3 @min-[640px]/emails:grid-cols-3">
      {(
        [
          { key: "brand", Icon: MailIcon, detail: brandName },
          {
            key: "languages",
            Icon: GlobeIcon,
            detail: t("emails.localeCount", { count: locales }),
          },
          { key: "secure", Icon: ShieldCheckIcon, detail: t("emails.selfOnly") },
        ] as const
      ).map(({ key, Icon, detail }) => (
        <div key={key} className={cn(SURFACE, "flex items-start gap-3 px-3.5 py-3")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/6 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold">{t(`emails.summary.${key}`)}</p>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The sticky save bar: the outcome of the last action, and Cancel/Save for the open template. */
export function EmailSaveBar({
  error,
  feedback,
  dirty,
  disabled,
  invalid,
  saving,
  onDiscard,
  onSave,
}: {
  error: string | null;
  feedback: string | null;
  dirty: boolean;
  disabled: boolean;
  invalid: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation("organizations");
  return (
    <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-background/95 px-1 py-3 backdrop-blur-sm">
      <div className="min-w-0 text-xs">
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : (
          <p
            role="status"
            className={cn(
              "flex items-center gap-1.5",
              feedback ? "text-success" : "text-muted-foreground",
            )}
          >
            {feedback && <CircleCheckIcon className="size-3.5" />}
            {feedback || t(dirty ? "emails.unsaved" : "emails.noChanges")}
          </p>
        )}
      </div>
      <div className="ms-auto flex gap-2">
        <Button
          variant="outline"
          className={ACTION}
          disabled={disabled || !dirty}
          onClick={onDiscard}
        >
          {t("emails.cancel")}
        </Button>
        <Button className={ACTION} disabled={disabled || !dirty || invalid} onClick={onSave}>
          {saving && <LoaderCircleIcon className="animate-spin" />}
          {t(saving ? "emails.saving" : "emails.save")}
        </Button>
      </div>
    </footer>
  );
}
