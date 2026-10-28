import { BracesIcon } from "@qeetrix/icons";
import {
  Button,
  Field,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { type ChangeEvent, lazy, type RefObject, Suspense, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  type EmailTemplate,
  type EmailTemplateTranslation,
  sampleVar,
} from "@/modules/organizations/api/email-templates";
import { emailTextHTML } from "@/modules/organizations/email-template-model";
import type { EmailBodyEditorHandle } from "./email-body-editor";

// Tiptap and ProseMirror are most of this module's weight and only this editor uses them, so the
// editor loads when it is first shown.
const EmailBodyEditor = lazy(() =>
  import("./email-body-editor").then((m) => ({ default: m.EmailBodyEditor })),
);

export type EmailField = "subject" | "preheader" | "body";

/** The subject, preheader and body of one language, with a variable put in where the caret is. */
export function EmailContentTab({
  template,
  content,
  currentLocale,
  disabled,
  modern,
  activeField,
  localeName,
  onUpdate,
}: {
  template: EmailTemplate;
  content: EmailTemplateTranslation;
  currentLocale: string;
  disabled: boolean;
  modern: boolean;
  activeField: RefObject<EmailField>;
  localeName: (code: string) => string;
  onUpdate: (patch: Partial<EmailTemplateTranslation>) => void;
}) {
  const { t } = useTranslation("organizations");
  const bodyLabel = useId();
  const editorRef = useRef<EmailBodyEditorHandle>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const preheaderRef = useRef<HTMLInputElement>(null);

  function fieldChange(key: "subject" | "preheader") {
    return (event: ChangeEvent<HTMLInputElement>) => onUpdate({ [key]: event.target.value });
  }
  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    if (activeField.current === "body") {
      editorRef.current?.insertVariable(token);
      return;
    }
    const target = activeField.current === "subject" ? subjectRef.current : preheaderRef.current;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const field = activeField.current;
    onUpdate({ [field]: target.value.slice(0, start) + token + target.value.slice(end) });
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="mail-form">
      <div className="mail-form-tools">
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                tone="neutral"
                icon={BracesIcon}
                disabled={disabled || template.variables.length === 0}
              >
                {t("emails.variables")}
              </Button>
            }
          />
          <MenuContent align="end">
            {template.variables.map((variable) => (
              <MenuItem
                key={variable}
                description={t("emails.variableSample", {
                  sample:
                    variable === "tenant_name" ? t("emails.tenantNameSample") : sampleVar(variable),
                })}
                onClick={() => insertVariable(variable)}
              >
                <code>{`{{${variable}}}`}</code>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>
      <TextField
        ref={subjectRef}
        label={t("emails.fields.subject")}
        value={content.subject}
        maxLength={200}
        disabled={disabled}
        description={t("emails.subjectCount", { count: content.subject.length })}
        invalid={!content.subject.trim()}
        onFocus={() => {
          activeField.current = "subject";
        }}
        onChange={fieldChange("subject")}
      />
      <TextField
        ref={preheaderRef}
        label={t("emails.fields.preheader")}
        optional
        value={content.preheader ?? ""}
        maxLength={200}
        disabled={disabled || !modern}
        placeholder={t("emails.preheaderPlaceholder")}
        description={t("emails.preheaderHint")}
        onFocus={() => {
          activeField.current = "preheader";
        }}
        onChange={fieldChange("preheader")}
      />
      <div
        onFocusCapture={() => {
          activeField.current = "body";
        }}
      >
        {modern ? (
          // The editor isn't a form control a Field can label, so its label names it by id.
          <div className="mail-body-field">
            <span className="mail-label" id={bodyLabel}>
              {t("emails.fields.body")}
            </span>
            <Suspense fallback={<div className="mail-rte mail-rte-loading" />}>
              <EmailBodyEditor
                key={`${template.key}:${currentLocale}`}
                ref={editorRef}
                labelledBy={bodyLabel}
                variables={template.variables}
                value={content.body_html || emailTextHTML(content.body)}
                onChange={(body_html, body) => onUpdate({ body_html, body })}
                disabled={disabled}
                footer={
                  <>
                    <span>{localeName(currentLocale)}</span>
                    <span>{t("emails.characters", { count: content.body.length })}</span>
                  </>
                }
              />
            </Suspense>
          </div>
        ) : (
          <Field label={t("emails.fields.body")}>
            <Textarea
              value={content.body}
              onChange={(event) => onUpdate({ body: event.target.value })}
              disabled={disabled}
              rows={10}
            />
          </Field>
        )}
      </div>
    </div>
  );
}
