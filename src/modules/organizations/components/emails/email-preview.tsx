import { MonitorIcon, SmartphoneIcon } from "@qeetrix/icons";
import {
  Dialog,
  DialogBody,
  DialogContent,
  Heading,
  Skeleton,
  Text,
  Toggle,
  ToggleGroup,
} from "@qeetrix/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  EmailTemplate,
  EmailTemplateInput,
} from "@/modules/organizations/api/email-templates";
import {
  type EmailBrand,
  emailPreviewDocument,
  emailPreviewHeader,
  emailPreviewLinks,
  emailTemplateInput,
} from "@/modules/organizations/email-template-model";
import { useTemplateText } from "./email-list";

/**
 * One email as it's sent, with sample values: its inbox line (sender, subject, preheader), the
 * message in a sandboxed frame, and where its links go — the frame keeps them inert, since a live
 * link in organisation-written markup could navigate the console.
 */
export function EmailPreview({
  draft,
  locale,
  variables,
  brand,
  mode = "desktop",
  title,
}: {
  draft: EmailTemplateInput;
  locale: string;
  variables: string[];
  brand: EmailBrand;
  mode?: "desktop" | "mobile";
  title: string;
}) {
  const { t } = useTranslation("organizations");
  const [document, setDocument] = useState("");
  useEffect(() => {
    setDocument(emailPreviewDocument(draft, locale, variables, brand));
  }, [draft, locale, variables, brand]);
  const samples = emailPreviewHeader(draft, locale, variables, brand);
  const links = emailPreviewLinks(draft, locale, variables, brand);

  return (
    <div className="mail-sample">
      <div className="mail-inbox">
        <span className="mail-inbox-from">
          <strong>{brand.name || "Qeet ID"}</strong>
          <Text tone="subtle" size="sm">
            {t("emails.preview.now")}
          </Text>
        </span>
        <strong className="mail-inbox-subject">
          {samples.subject || t("emails.preview.noSubject")}
        </strong>
        <Text tone="subtle" size="sm" truncate>
          {samples.preheader || t("emails.preview.noPreheader")}
        </Text>
      </div>
      {document ? (
        <iframe
          title={title}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={document}
          className="mail-frame"
          data-mode={mode}
        />
      ) : (
        <Skeleton className="mail-frame" />
      )}
      <div className="mail-links">
        <Text weight="medium" size="sm">
          {t("emails.preview.linksTitle")}
        </Text>
        {links.length === 0 ? (
          <Text tone="subtle" size="sm">
            {t("emails.preview.noLinks")}
          </Text>
        ) : (
          <>
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <Text size="sm">{link.text}</Text>
                  <Text mono size="sm" tone="subtle" className="mail-link">
                    {link.href}
                  </Text>
                </li>
              ))}
            </ul>
            <Text tone="subtle" size="sm">
              {t("emails.preview.linksHint")}
            </Text>
          </>
        )}
      </div>
    </div>
  );
}

/** The editor's inspector: the open template's draft, desktop or phone width, and who gets it. */
export function EmailPreviewPanel({
  name,
  draft,
  locale,
  template,
  brand,
}: {
  name: string;
  draft: EmailTemplateInput;
  locale: string;
  template: EmailTemplate;
  brand: EmailBrand;
}) {
  const { t } = useTranslation("organizations");
  const text = useTemplateText()(template);
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  // Only invitations and magic links are sent with the organisation's own template so far.
  const tenantDelivery = template.delivery_scope === "tenant";
  return (
    <aside className="mail-preview" aria-label={t("emails.previewPanel")}>
      <div className="mail-preview-head">
        <Heading level={3} size="title-sm">
          {t("emails.preview.title")}
        </Heading>
        <ToggleGroup
          size="sm"
          aria-label={t("emails.previewSize")}
          value={[mode]}
          onValueChange={(next) => {
            const value = next[0];
            if (value === "desktop" || value === "mobile") setMode(value);
          }}
        >
          <Toggle value="desktop" icon={MonitorIcon}>
            {t("emails.desktop")}
          </Toggle>
          <Toggle value="mobile" icon={SmartphoneIcon}>
            {t("emails.mobile")}
          </Toggle>
        </ToggleGroup>
      </div>
      <EmailPreview
        draft={draft}
        locale={locale}
        variables={template.variables}
        brand={brand}
        mode={mode}
        title={t("emails.previewTitle", { name: text.name })}
      />
      <Text tone="subtle" size="sm" className="mail-delivery">
        {t(tenantDelivery ? "emails.delivery.tenant" : "emails.delivery.platform", { name })}
      </Text>
    </aside>
  );
}

/** Every template's current draft side by side, in its default language. */
export function EmailPreviewAllDialog({
  open,
  onOpenChange,
  templates,
  drafts,
  saved,
  brand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EmailTemplate[];
  drafts: Record<string, EmailTemplateInput>;
  saved: Record<string, EmailTemplate>;
  brand: EmailBrand;
}) {
  const { t } = useTranslation("organizations");
  const text = useTemplateText();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        title={t("emails.previewAll")}
        description={t("emails.previewAllDescription")}
      >
        <DialogBody>
          <div className="mail-all">
            {templates.map((item) => {
              const draft = drafts[item.key] ?? emailTemplateInput(saved[item.key] ?? item);
              const { name } = text(item);
              return (
                <section key={item.key} className="mail-all-item" aria-label={name}>
                  <Heading level={3} size="title-sm">
                    {name}
                  </Heading>
                  <EmailPreview
                    draft={draft}
                    locale={draft.options.default_locale ?? "en"}
                    variables={item.variables}
                    brand={brand}
                    title={t("emails.previewTitle", { name })}
                  />
                </section>
              );
            })}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
