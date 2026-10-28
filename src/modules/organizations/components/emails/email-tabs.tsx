import { PlusIcon, TextAlignCenterIcon, TextAlignStartIcon, TrashIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Field,
  IconButton,
  Select,
  Switch,
  Textarea,
  Toggle,
  ToggleGroup,
} from "@qeetrix/react";
import { Link as RouterLink } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  EmailTemplateInput,
  EmailTemplateTranslation,
} from "@/modules/organizations/api/email-templates";
import { Detail } from "@/modules/organizations/components/settings/settings-parts";
import {
  EMAIL_LOCALES,
  type EmailBrand,
  emailPrimary,
  emailHTMLText,
  emailLocaleContent,
  emailTextHTML,
  sanitizeEmailHTML,
  validEmailAssetURL,
} from "@/modules/organizations/email-template-model";

const MAX_TRANSLATIONS = 20; // the server's most per template

/**
 * Design: the logo and the header's alignment are this template's; its colour and sender name are
 * the organisation's, from Branding. Emails come from Qeet ID's own address with that name, and
 * show a logo only when Branding's is a web address (an uploaded one can't be sent).
 */
export function EmailDesignTab({
  name,
  draft,
  disabled,
  brand,
  onChange,
}: {
  name: string;
  draft: EmailTemplateInput;
  disabled: boolean;
  brand: EmailBrand;
  onChange: (draft: EmailTemplateInput) => void;
}) {
  const { t } = useTranslation("organizations");
  const alignLabel = useId();
  const alignment = draft.options.alignment === "left" ? "left" : "center";
  const logoSendable = !!brand.logo && validEmailAssetURL(brand.logo);
  const primary = emailPrimary(brand);
  return (
    <div className="mail-form">
      <Switch
        label={t("emails.design.logo", { name })}
        description={
          logoSendable
            ? t("emails.design.logoHint")
            : brand.logo
              ? t("emails.design.logoUploaded")
              : t("emails.design.logoNone")
        }
        checked={draft.options.show_logo !== false}
        disabled={disabled}
        onCheckedChange={(checked) =>
          onChange({ ...draft, options: { ...draft.options, show_logo: checked } })
        }
      />
      <div className="mail-body-field">
        <span className="mail-label" id={alignLabel}>
          {t("emails.design.alignment")}
        </span>
        <ToggleGroup
          className="mail-align"
          aria-labelledby={alignLabel}
          value={[alignment]}
          disabled={disabled}
          onValueChange={(next) => {
            const value = next[0];
            if (value === "left" || value === "center")
              onChange({ ...draft, options: { ...draft.options, alignment: value } });
          }}
        >
          <Toggle value="left" icon={TextAlignStartIcon}>
            {t("emails.design.left")}
          </Toggle>
          <Toggle value="center" icon={TextAlignCenterIcon}>
            {t("emails.design.center")}
          </Toggle>
        </ToggleGroup>
      </div>
      <dl className="account-details">
        <Detail
          label={t("emails.design.brand")}
          hint={t("emails.design.brandHint")}
          action={
            <Button variant="ghost" render={<RouterLink to="/settings/branding" />}>
              {t("emails.design.changeInBranding")}
            </Button>
          }
        >
          <span className="mail-swatch">
            {/* The organisation's own brand colour (domain data, from Branding), not a UI colour. */}
            <span style={{ background: primary }} aria-hidden="true" />
            <span className="account-mono">{primary}</span>
          </span>
        </Detail>
        <Detail
          label={t("emails.design.sender")}
          hint={t("emails.design.senderHint")}
          action={
            <Button variant="ghost" render={<RouterLink to="/settings/branding" />}>
              {t("emails.design.changeInBranding")}
            </Button>
          }
        >
          {brand.name}
        </Detail>
      </dl>
    </div>
  );
}

/**
 * Languages: English and the translations, the default first. The server sends the one closest
 * to the person's profile language, else the default; a new one starts as a copy of English.
 */
export function EmailLanguagesTab({
  draft,
  disabled,
  localeName,
  onChange,
  onEditLocale,
}: {
  draft: EmailTemplateInput;
  disabled: boolean;
  localeName: (code: string) => string;
  onChange: (draft: EmailTemplateInput) => void;
  onEditLocale: (code: string) => void;
}) {
  const { t } = useTranslation("organizations");
  const translations = draft.options.translations ?? {};
  const fallback = draft.options.default_locale || "en";
  const locales = ["en", ...Object.keys(translations)].sort((a, b) =>
    a === fallback ? -1 : b === fallback ? 1 : 0,
  );
  const addable: string[] = EMAIL_LOCALES.filter((code) => code !== "en" && !translations[code]);
  const [adding, setAdding] = useState<string>(addable[0] ?? "");
  const next = addable.includes(adding) ? adding : (addable[0] ?? "");
  const full = Object.keys(translations).length >= MAX_TRANSLATIONS;

  function remove(code: string) {
    const rest = { ...translations };
    delete rest[code];
    onChange({
      ...draft,
      options: {
        ...draft.options,
        translations: rest,
        default_locale: fallback === code ? "en" : fallback,
      },
    });
  }

  return (
    <div className="mail-form">
      <ul className="account-rows">
        {locales.map((code) => (
          <li key={code} className="account-row">
            <span className="account-icon mail-locale" aria-hidden="true">
              {code.toUpperCase()}
            </span>
            <span className="account-row-text">
              <span className="account-row-name">
                <strong>{localeName(code)}</strong>
                {code === fallback ? (
                  <Badge tone="neutral" size="sm">
                    {t("emails.languages.default")}
                  </Badge>
                ) : null}
              </span>
              <small>
                {code === fallback
                  ? t("emails.languages.defaultLine")
                  : t("emails.languages.line", { language: localeName(code) })}
              </small>
            </span>
            <span className="account-row-actions">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("emails.languages.editLabel", { language: localeName(code) })}
                onClick={() => onEditLocale(code)}
              >
                {t("emails.languages.edit")}
              </Button>
              {code !== fallback ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={t("emails.languages.makeDefaultLabel", {
                    language: localeName(code),
                  })}
                  onClick={() =>
                    onChange({ ...draft, options: { ...draft.options, default_locale: code } })
                  }
                >
                  {t("emails.languages.makeDefault")}
                </Button>
              ) : null}
              {code !== "en" ? (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={TrashIcon}
                  aria-label={t("emails.languages.remove", { language: localeName(code) })}
                  disabled={disabled}
                  onClick={() => remove(code)}
                />
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {addable.length > 0 ? (
        <div className="mail-add-language">
          <Field
            label={t("emails.languages.add")}
            description={
              full
                ? t("emails.languages.full", { max: MAX_TRANSLATIONS })
                : t("emails.languages.addHint")
            }
          >
            <Select
              value={next}
              disabled={disabled || full}
              onValueChange={(code) => code && setAdding(code)}
              items={addable.map((code) => ({ value: code, label: localeName(code) }))}
            />
          </Field>
          <Button
            variant="soft"
            size="lg"
            icon={PlusIcon}
            disabled={disabled || full || !next}
            onClick={() => {
              onChange({
                ...draft,
                options: {
                  ...draft.options,
                  translations: { ...translations, [next]: { ...emailLocaleContent(draft, "en") } },
                },
              });
              onEditLocale(next);
            }}
          >
            {t("emails.languages.addButton")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Advanced: the template's key, its plain-text version and its HTML, edited as source. */
export function EmailAdvancedTab({
  templateKey,
  content,
  disabled,
  modern,
  onUpdate,
}: {
  templateKey: string;
  content: EmailTemplateTranslation;
  disabled: boolean;
  modern: boolean;
  onUpdate: (patch: Partial<EmailTemplateTranslation>) => void;
}) {
  const { t } = useTranslation("organizations");
  return (
    <div className="mail-form">
      <dl className="account-details">
        <Detail label={t("emails.advanced.key")} hint={t("emails.advanced.keyHint")}>
          <span className="account-mono">{templateKey}</span>
        </Detail>
      </dl>
      <Field label={t("emails.advanced.text")} description={t("emails.advanced.textHint")}>
        <Textarea
          className="mail-code"
          value={content.body}
          disabled={disabled}
          rows={6}
          onChange={(event) => onUpdate({ body: event.target.value })}
        />
      </Field>
      <Field label={t("emails.advanced.html")} description={t("emails.advanced.safety")}>
        <Textarea
          className="mail-code"
          value={content.body_html || emailTextHTML(content.body)}
          disabled={disabled || !modern}
          rows={8}
          onChange={(event) =>
            onUpdate({ body_html: event.target.value, body: emailHTMLText(event.target.value) })
          }
          onBlur={() => {
            if (content.body_html) onUpdate({ body_html: sanitizeEmailHTML(content.body_html) });
          }}
        />
      </Field>
    </div>
  );
}
