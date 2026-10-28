import { RotateCcwIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Heading,
  Select,
  Tab,
  Tabs,
  TabsList,
  TabsPanel,
  Text,
} from "@qeetrix/react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  EmailTemplate,
  EmailTemplateCapabilities,
  EmailTemplateInput,
  EmailTemplateTranslation,
} from "@/modules/organizations/api/email-templates";
import type { EmailBrand, EmailDraftIssue } from "@/modules/organizations/email-template-model";
import { type EmailField, EmailContentTab } from "./email-content-tab";
import { useTemplateText } from "./email-list";
import { EmailPreviewPanel } from "./email-preview";
import { EmailAdvancedTab, EmailDesignTab, EmailLanguagesTab } from "./email-tabs";

const TABS = ["content", "design", "languages", "advanced"] as const;
type EmailTab = (typeof TABS)[number];

/** The language's name in the reader's language: "French", "हिन्दी"… */
export function useLocaleName() {
  const { i18n } = useTranslation();
  return (code: string) =>
    new Intl.DisplayNames([i18n.language], { type: "language" }).of(code) ?? code;
}

/**
 * The open template's editor, one ruled surface: its toolbar (the template, its language, Reset,
 * Discard and Save), its tabs, then the fields beside the live preview.
 */
export function EmailTemplateEditor({
  name,
  template,
  draft,
  content,
  currentLocale,
  errors,
  capabilities,
  brand,
  disabled,
  dirty,
  pending,
  error,
  feedback,
  onLocaleChange,
  onChange,
  onUpdate,
  onSave,
  onReset,
  onDiscard,
}: {
  name: string;
  template: EmailTemplate;
  draft: EmailTemplateInput;
  content: EmailTemplateTranslation;
  currentLocale: string;
  errors: EmailDraftIssue[];
  capabilities?: EmailTemplateCapabilities;
  brand: EmailBrand;
  disabled: boolean;
  dirty: boolean;
  pending: "save" | "reset" | "test" | null;
  error: string | null;
  feedback: string | null;
  onLocaleChange: (code: string) => void;
  onChange: (draft: EmailTemplateInput) => void;
  onUpdate: (patch: Partial<EmailTemplateTranslation>) => void;
  onSave: () => void;
  onReset: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation("organizations");
  const id = useId();
  const text = useTemplateText()(template);
  const localeName = useLocaleName();
  const [tab, setTab] = useState<EmailTab>("content");
  // Outlives the tab, so a variable still lands in the field last focused before switching tabs.
  const activeField = useRef<EmailField>("body");
  const modern = capabilities?.rich_text === true;
  const locales = ["en", ...Object.keys(draft.options.translations ?? {})];

  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as EmailTab)}>
      <section className="mail-editor" aria-labelledby={`${id}-title`}>
        <header className="mail-toolbar">
          <div className="mail-toolbar-title">
            <span className="account-section-name">
              <Heading level={2} size="title-md" id={`${id}-title`}>
                {text.name}
              </Heading>
              <Badge tone="neutral" size="sm">
                {t(template.custom ? "emails.custom" : "emails.default")}
              </Badge>
            </span>
            <Text tone="subtle" size="sm">
              {text.description}
            </Text>
          </div>
          <div className="mail-toolbar-actions">
            {locales.length > 1 ? (
              <Select
                className="mail-language"
                aria-label={t("emails.editLanguage")}
                value={currentLocale}
                disabled={disabled}
                onValueChange={(code) => code && onLocaleChange(code)}
                items={locales.map((code) => ({ value: code, label: localeName(code) }))}
              />
            ) : null}
            <Button
              variant="ghost"
              icon={RotateCcwIcon}
              loading={pending === "reset"}
              disabled={disabled || !template.custom}
              onClick={onReset}
            >
              {t("emails.reset")}
            </Button>
            {dirty ? (
              <Button variant="ghost" disabled={disabled} onClick={onDiscard}>
                {t("emails.discardChanges")}
              </Button>
            ) : null}
            <Button
              loading={pending === "save"}
              disabled={disabled || !dirty || errors.length > 0}
              onClick={onSave}
            >
              {t("emails.save")}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="account-failure mail-toolbar-status">
              {error}
            </p>
          ) : (
            <Text tone="subtle" size="sm" className="mail-toolbar-status" role="status">
              {feedback || t(dirty ? "emails.unsavedChanges" : "emails.noChanges")}
            </Text>
          )}
        </header>
        <TabsList activateOnFocus={false} aria-label={t("emails.editorTabs")} className="mail-tabs">
          {TABS.map((value) => (
            <Tab key={value} value={value}>
              {t(`emails.tabs.${value}`)}
            </Tab>
          ))}
        </TabsList>
        <div className="mail-body">
          <div className="mail-fields">
            <TabsPanel value="content">
              <EmailContentTab
                template={template}
                content={content}
                currentLocale={currentLocale}
                disabled={disabled}
                modern={modern}
                activeField={activeField}
                localeName={localeName}
                onUpdate={onUpdate}
              />
            </TabsPanel>
            <TabsPanel value="design">
              <EmailDesignTab
                name={name}
                draft={draft}
                disabled={disabled || !modern}
                brand={brand}
                onChange={onChange}
              />
            </TabsPanel>
            <TabsPanel value="languages">
              <EmailLanguagesTab
                draft={draft}
                disabled={disabled || !capabilities?.localization}
                localeName={localeName}
                onChange={onChange}
                onEditLocale={(code) => {
                  onLocaleChange(code);
                  setTab("content");
                }}
              />
            </TabsPanel>
            <TabsPanel value="advanced">
              <EmailAdvancedTab
                templateKey={template.key}
                content={content}
                disabled={disabled}
                modern={modern}
                onUpdate={onUpdate}
              />
            </TabsPanel>
            {errors.length > 0 && (
              <div role="alert" className="mail-issues">
                {errors.map((issue) => (
                  <p key={issue}>{t(`emails.validation.${issue}`)}</p>
                ))}
              </div>
            )}
            {!modern && <p className="account-note">{t("emails.legacy")}</p>}
          </div>
          <EmailPreviewPanel
            name={name}
            draft={draft}
            locale={currentLocale}
            template={template}
            brand={brand}
          />
        </div>
      </section>
    </Tabs>
  );
}
