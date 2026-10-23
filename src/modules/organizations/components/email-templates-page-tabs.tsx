import {
  Button,
  cn,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@qeetrix/ui";
import {
  ArrowUpRightIcon,
  GlobeIcon,
  PlusIcon,
  TextAlignCenterIcon,
  TextAlignStartIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import type { EmailTemplateInput, EmailTemplateTranslation } from "../api/email-templates";
import {
  EMAIL_LOCALES,
  type EmailBrand,
  emailHTMLText,
  emailLocaleContent,
  emailTextHTML,
  sanitizeEmailHTML,
} from "../email-template-model";

const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const INPUT =
  "h-8 min-w-0 rounded-md bg-background/25 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";

export const EMAIL_TABS = ["content", "design", "localization", "advanced"] as const;
export type EmailTab = (typeof EMAIL_TABS)[number];

/** The editor's tab strip, with arrow, Home and End key navigation. */
export function EmailEditorTabList({
  id,
  tab,
  onChange,
}: {
  id: string;
  tab: EmailTab;
  onChange: (tab: EmailTab) => void;
}) {
  const { t } = useTranslation("organizations");
  return (
    <div
      role="tablist"
      aria-label={t("emails.editorTabs")}
      className="flex min-w-0 overflow-x-auto border-b border-border/60 px-2"
    >
      {EMAIL_TABS.map((value, index) => (
        <button
          key={value}
          type="button"
          role="tab"
          id={`${id}-${value}-tab`}
          aria-controls={`${id}-tabpanel`}
          aria-selected={tab === value}
          tabIndex={tab === value ? 0 : -1}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? EMAIL_TABS.length - 1
                  : (index + (event.key === "ArrowRight" ? 1 : -1) + EMAIL_TABS.length) %
                    EMAIL_TABS.length;
            const nextTab = EMAIL_TABS[next];
            // Unreachable: every branch yields an index in [0, EMAIL_TABS.length).
            if (nextTab === undefined) return;
            onChange(nextTab);
            document.getElementById(`${id}-${nextTab}-tab`)?.focus();
          }}
          onClick={() => onChange(value)}
          className={cn(
            "min-h-9 shrink-0 cursor-pointer border-b-2 px-3 text-[10px] font-medium focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:min-h-11",
            tab === value
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`emails.tabs.${value}`)}
        </button>
      ))}
    </div>
  );
}

export function EmailDesignTab({
  id,
  draft,
  disabled,
  modern,
  brand,
  onChange,
}: {
  id: string;
  draft: EmailTemplateInput;
  disabled: boolean;
  modern: boolean;
  brand: EmailBrand;
  onChange: (draft: EmailTemplateInput) => void;
}) {
  const { t } = useTranslation("organizations");
  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold">{t("emails.design.title")}</h3>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-logo`} className="text-xs">
          {t("emails.design.logo")}
        </label>
        <Switch
          id={`${id}-logo`}
          checked={draft.options.show_logo !== false}
          disabled={disabled || !modern}
          onCheckedChange={(checked) =>
            onChange({ ...draft, options: { ...draft.options, show_logo: checked } })
          }
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs">{t("emails.design.alignment")}</legend>
        <div className="inline-flex rounded-md border border-border/70 bg-muted/20 p-0.5">
          {(["left", "center"] as const).map((alignment) => {
            const Icon = alignment === "left" ? TextAlignStartIcon : TextAlignCenterIcon;
            return (
              <button
                key={alignment}
                type="button"
                aria-label={t(`emails.design.${alignment}`)}
                title={t(`emails.design.${alignment}`)}
                aria-pressed={draft.options.alignment === alignment}
                disabled={disabled || !modern}
                onClick={() => onChange({ ...draft, options: { ...draft.options, alignment } })}
                className={cn(
                  "grid size-8 cursor-pointer place-items-center rounded focus-visible:outline-2 focus-visible:outline-ring",
                  draft.options.alignment === alignment
                    ? "bg-card text-primary shadow-xs"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="border-t border-border/60 pt-4">
        <p className="mb-2 text-xs font-medium">{t("emails.design.brand")}</p>
        <div className="flex items-center gap-2">
          <span
            className="size-6 rounded-full border border-border/60"
            style={{
              backgroundColor: /^#[\da-f]{6}$/i.test(brand.primary ?? "")
                ? brand.primary
                : "#f97316",
            }}
          />
          <code className="text-xs text-muted-foreground">{brand.primary || "#f97316"}</code>
        </div>
        <Link
          to="/settings/branding"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
        >
          {t("emails.design.manage")}
          <ArrowUpRightIcon className="size-3" />
        </Link>
      </div>
    </div>
  );
}

export function EmailLocalizationTab({
  id,
  draft,
  disabled,
  localization,
  newLocale,
  localeName,
  onChange,
  onNewLocaleChange,
  onEditLocale,
}: {
  id: string;
  draft: EmailTemplateInput;
  disabled: boolean;
  localization: boolean;
  newLocale: string;
  localeName: (code: string) => string;
  onChange: (draft: EmailTemplateInput) => void;
  onNewLocaleChange: (code: string) => void;
  onEditLocale: (code: string) => void;
}) {
  const { t } = useTranslation("organizations");
  const locales = ["en", ...Object.keys(draft.options.translations ?? {})];
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold">{t("emails.localization.title")}</h3>
      <div className="space-y-2">
        {locales.map((code) => (
          <div
            key={code}
            className="flex items-center justify-between gap-2 border-b border-border/50 py-2"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onEditLocale(code)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-sm text-xs hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <GlobeIcon className="size-3.5" />
              {localeName(code)}
              {draft.options.default_locale === code && (
                <span className="rounded bg-primary/8 px-1.5 py-0.5 text-[9px] text-primary">
                  {t("emails.default")}
                </span>
              )}
            </button>
            {code !== "en" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("emails.localization.remove", { language: localeName(code) })}
                title={t("emails.localization.remove", { language: localeName(code) })}
                disabled={disabled}
                className="size-7"
                onClick={() => {
                  const translations = { ...draft.options.translations };
                  delete translations[code];
                  onChange({
                    ...draft,
                    options: {
                      ...draft.options,
                      translations,
                      default_locale:
                        draft.options.default_locale === code ? "en" : draft.options.default_locale,
                    },
                  });
                }}
              >
                <TrashIcon className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={newLocale}
          onValueChange={(value) => value && onNewLocaleChange(value)}
          disabled={disabled || !localization}
        >
          <SelectTrigger
            aria-label={t("emails.localization.addLanguage")}
            className={cn(INPUT, "flex-1")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_LOCALES.filter((code) => code !== "en").map((code) => (
              <SelectItem key={code} value={code}>
                {localeName(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className={ACTION}
          disabled={disabled || !localization || !!draft.options.translations?.[newLocale]}
          onClick={() => {
            onChange({
              ...draft,
              options: {
                ...draft.options,
                translations: {
                  ...draft.options.translations,
                  [newLocale]: { ...emailLocaleContent(draft, "en") },
                },
              },
            });
            onEditLocale(newLocale);
          }}
        >
          <PlusIcon />
          {t("emails.localization.add")}
        </Button>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-default-locale`} className="text-xs">
          {t("emails.localization.default")}
        </FieldLabel>
        <Select
          value={draft.options.default_locale || "en"}
          onValueChange={(value) =>
            value && onChange({ ...draft, options: { ...draft.options, default_locale: value } })
          }
          disabled={disabled || !localization}
        >
          <SelectTrigger id={`${id}-default-locale`} className={INPUT}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((code) => (
              <SelectItem key={code} value={code}>
                {localeName(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <p className="text-[11px] leading-5 text-muted-foreground">{t("emails.localization.note")}</p>
    </div>
  );
}

export function EmailAdvancedTab({
  id,
  templateKey,
  content,
  disabled,
  modern,
  onUpdate,
}: {
  id: string;
  templateKey: string;
  content: EmailTemplateTranslation;
  disabled: boolean;
  modern: boolean;
  onUpdate: (patch: Partial<EmailTemplateTranslation>) => void;
}) {
  const { t } = useTranslation("organizations");
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-muted-foreground">{t("emails.advanced.key")}</p>
        <code className="mt-1 block text-xs">{templateKey}</code>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-text`} className="text-xs">
          {t("emails.advanced.text")}
        </FieldLabel>
        <Textarea
          id={`${id}-text`}
          value={content.body}
          disabled={disabled}
          onChange={(event) => onUpdate({ body: event.target.value })}
          className="min-h-32 font-mono text-[11px]"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-html`} className="text-xs">
          {t("emails.advanced.html")}
        </FieldLabel>
        <Textarea
          id={`${id}-html`}
          value={content.body_html || emailTextHTML(content.body)}
          disabled={disabled || !modern}
          onChange={(event) =>
            onUpdate({
              body_html: event.target.value,
              body: emailHTMLText(event.target.value),
            })
          }
          onBlur={() => {
            if (content.body_html) onUpdate({ body_html: sanitizeEmailHTML(content.body_html) });
          }}
          className="min-h-40 font-mono text-[11px]"
        />
      </Field>
      <p className="text-[10px] leading-4 text-muted-foreground">{t("emails.advanced.safety")}</p>
    </div>
  );
}
