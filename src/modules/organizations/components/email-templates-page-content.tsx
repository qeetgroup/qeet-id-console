import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@qeetrix/ui";
import { BracesIcon } from "@qeetrix/icons";
import { type ChangeEvent, type RefObject, useRef } from "react";
import { useTranslation } from "react-i18next";

import type {
  EmailTemplate,
  EmailTemplateInput,
  EmailTemplateTranslation,
} from "../api/email-templates";
import { emailTextHTML } from "../email-template-model";
import { EmailBodyEditor, type EmailBodyEditorHandle } from "./email-body-editor";

const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const INPUT =
  "h-8 min-w-0 rounded-md bg-background/25 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";

export type EmailField = "subject" | "preheader" | "body";

/** The subject, preheader and body of one language, with variable insertion at the caret. */
export function EmailContentTab({
  id,
  template,
  draft,
  content,
  currentLocale,
  disabled,
  modern,
  activeField,
  localeName,
  onUpdate,
  onLocaleChange,
}: {
  id: string;
  template: EmailTemplate;
  draft: EmailTemplateInput;
  content: EmailTemplateTranslation;
  currentLocale: string;
  disabled: boolean;
  modern: boolean;
  // Outlives the tab, so a variable still lands in the field last focused before switching tabs.
  activeField: RefObject<EmailField>;
  localeName: (code: string) => string;
  onUpdate: (patch: Partial<EmailTemplateTranslation>) => void;
  onLocaleChange: (code: string) => void;
}) {
  const { t } = useTranslation("organizations");
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
    <div className="space-y-3 **:data-[slot=field]:gap-1.5 **:data-[slot=field-label]:text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`${id}-subject`} className="text-[11px] font-medium">
          {t("emails.fields.subject")} <span className="text-destructive">*</span>
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className={cn(ACTION, "h-7 px-2 text-[10px]")}
                disabled={disabled || template.variables.length === 0}
              />
            }
          >
            <BracesIcon className="size-3" />
            {t("emails.variables")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {template.variables.map((variable) => (
              <DropdownMenuItem key={variable} onClick={() => insertVariable(variable)}>
                <code>{`{{${variable}}}`}</code>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Input
        ref={subjectRef}
        id={`${id}-subject`}
        value={content.subject}
        required
        disabled={disabled}
        onFocus={() => {
          activeField.current = "subject";
        }}
        onChange={fieldChange("subject")}
        maxLength={200}
        className={INPUT}
        aria-invalid={!content.subject.trim()}
      />
      <Field>
        <FieldLabel htmlFor={`${id}-preheader`}>{t("emails.fields.preheader")}</FieldLabel>
        <Input
          ref={preheaderRef}
          id={`${id}-preheader`}
          value={content.preheader ?? ""}
          disabled={disabled || !modern}
          onFocus={() => {
            activeField.current = "preheader";
          }}
          onChange={fieldChange("preheader")}
          maxLength={200}
          className={INPUT}
        />
      </Field>
      <Field>
        <FieldLabel>
          {t("emails.fields.body")} <span className="text-destructive">*</span>
        </FieldLabel>
        <div
          onFocusCapture={() => {
            activeField.current = "body";
          }}
        >
          {modern ? (
            <EmailBodyEditor
              key={`${template.key}:${currentLocale}`}
              ref={editorRef}
              variables={template.variables}
              value={content.body_html || emailTextHTML(content.body)}
              onChange={(body_html, body) => onUpdate({ body_html, body })}
              disabled={disabled}
            />
          ) : (
            <Textarea
              aria-label={t("emails.fields.body")}
              value={content.body}
              onChange={(event) => onUpdate({ body: event.target.value })}
              disabled={disabled}
              rows={10}
              className="text-xs"
            />
          )}
        </div>
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{t("emails.language", { name: localeName(currentLocale) })}</span>
        <span>{t("emails.characters", { count: content.body.length })}</span>
      </div>
      {Object.keys(draft.options.translations ?? {}).length > 0 && (
        <Select
          value={currentLocale}
          onValueChange={(value) => value && onLocaleChange(value)}
          disabled={disabled}
        >
          <SelectTrigger aria-label={t("emails.editLanguage")} className={INPUT}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["en", ...Object.keys(draft.options.translations ?? {})].map((code) => (
              <SelectItem key={code} value={code}>
                {localeName(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
