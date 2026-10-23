import { Button, cn } from "@qeetrix/ui";
import { RotateCcwIcon } from "@qeetrix/icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { StatusPill } from "@/platform/components/status-pill";
import type {
  EmailTemplate,
  EmailTemplateCapabilities,
  EmailTemplateInput,
  EmailTemplateTranslation,
} from "../api/email-templates";
import type { EmailBrand, EmailDraftIssue } from "../email-template-model";
import { type EmailField, EmailContentTab } from "./email-templates-page-content";
import { EmailPreviewPanel } from "./email-templates-page-preview";
import {
  EmailAdvancedTab,
  EmailDesignTab,
  EmailEditorTabList,
  EmailLocalizationTab,
  type EmailTab,
} from "./email-templates-page-tabs";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

/** The selected template's editor: its tabs, validation messages and live preview. */
export function EmailTemplateEditor({
  id,
  template,
  draft,
  content,
  currentLocale,
  errors,
  modern,
  disabled,
  capabilities,
  brand,
  localeName,
  onLocaleChange,
  onChange,
  onUpdate,
  onReset,
}: {
  id: string;
  template: EmailTemplate;
  draft: EmailTemplateInput;
  content: EmailTemplateTranslation;
  currentLocale: string;
  errors: EmailDraftIssue[];
  modern: boolean;
  disabled: boolean;
  capabilities?: EmailTemplateCapabilities;
  brand: EmailBrand;
  localeName: (code: string) => string;
  onLocaleChange: (code: string) => void;
  onChange: (draft: EmailTemplateInput) => void;
  onUpdate: (patch: Partial<EmailTemplateTranslation>) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation("organizations");
  const [tab, setTab] = useState<EmailTab>("content");
  const [newLocale, setNewLocale] = useState("fr");
  const activeField = useRef<EmailField>("body");

  return (
    <section
      className={cn(SURFACE, "flex flex-col overflow-hidden")}
      aria-labelledby={`${id}-editor`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${id}-editor`} className="font-heading text-sm font-semibold">
              {t("emails.templateTitle", { name: template.name })}
            </h2>
            <StatusPill
              kind={template.custom ? "success" : "neutral"}
              className="px-1.5 py-0 text-[9px]"
            >
              {t(template.custom ? "emails.custom" : "emails.default")}
            </StatusPill>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{template.description}</p>
        </div>
        <Button
          variant="outline"
          className={cn(ACTION, "h-7 px-2 text-[10px]")}
          disabled={disabled || !template.custom}
          onClick={onReset}
        >
          <RotateCcwIcon className="size-3" />
          {t("emails.reset")}
        </Button>
      </div>
      <EmailEditorTabList id={id} tab={tab} onChange={setTab} />
      <div className="grid min-w-0 flex-1 @min-[800px]/emails:grid-cols-[minmax(0,1.2fr)_minmax(210px,0.9fr)]">
        <div
          role="tabpanel"
          id={`${id}-tabpanel`}
          aria-labelledby={`${id}-${tab}-tab`}
          className="min-w-0 p-3.5"
        >
          {tab === "content" && (
            <EmailContentTab
              id={id}
              template={template}
              draft={draft}
              content={content}
              currentLocale={currentLocale}
              disabled={disabled}
              modern={modern}
              activeField={activeField}
              localeName={localeName}
              onUpdate={onUpdate}
              onLocaleChange={onLocaleChange}
            />
          )}
          {tab === "design" && (
            <EmailDesignTab
              id={id}
              draft={draft}
              disabled={disabled}
              modern={modern}
              brand={brand}
              onChange={onChange}
            />
          )}
          {tab === "localization" && (
            <EmailLocalizationTab
              id={id}
              draft={draft}
              disabled={disabled}
              localization={!!capabilities?.localization}
              newLocale={newLocale}
              localeName={localeName}
              onChange={onChange}
              onNewLocaleChange={setNewLocale}
              onEditLocale={(code) => {
                onLocaleChange(code);
                setTab("content");
              }}
            />
          )}
          {tab === "advanced" && (
            <EmailAdvancedTab
              id={id}
              templateKey={template.key}
              content={content}
              disabled={disabled}
              modern={modern}
              onUpdate={onUpdate}
            />
          )}
          {errors.length > 0 && (
            <div role="alert" className="mt-3 space-y-1 text-[11px] text-destructive">
              {errors.map((issue) => (
                <p key={issue}>{t(`emails.validation.${issue}`)}</p>
              ))}
            </div>
          )}
          {!modern && <p className="mt-3 text-[11px] text-warning">{t("emails.legacy")}</p>}
        </div>
        <EmailPreviewPanel draft={draft} locale={currentLocale} template={template} brand={brand} />
      </div>
    </section>
  );
}
