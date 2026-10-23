import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@qeetrix/ui";
import { MonitorIcon, SmartphoneIcon } from "@qeetrix/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { EmailTemplate, EmailTemplateInput } from "../api/email-templates";
import {
  type EmailBrand,
  emailPreviewDocument,
  emailPreviewHeader,
  emailPreviewLinks,
  emailTemplateInput,
} from "../email-template-model";

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

  // An inbox row shows what recipients see first, where a too-long subject or an empty preheader
  // becomes obvious.
  const samples = emailPreviewHeader(draft, locale, variables, brand);
  const links = emailPreviewLinks(draft, locale, variables, brand);
  const sender = brand.name || "Qeet ID";

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start gap-3 border-b bg-muted/30 px-3 py-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        >
          {sender.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-xs font-semibold">{sender}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {t("emails.preview.now")}
            </span>
          </div>
          <p className="truncate text-xs font-medium">
            {samples.subject || t("emails.preview.noSubject")}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {samples.preheader || t("emails.preview.noPreheader")}
          </p>
        </div>
      </div>

      <div className={cn("bg-muted/15 p-3", mode === "mobile" && "flex justify-center")}>
        {document ? (
          <iframe
            title={title}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={document}
            className={cn(
              "block w-full rounded border border-border/50 bg-white",
              mode === "mobile" ? "h-120 max-w-[22rem]" : "h-140", // room for a real template
            )}
          />
        ) : (
          <Skeleton className={cn("w-full rounded", mode === "mobile" ? "h-120" : "h-140")} />
        )}
      </div>

      <div className="border-t px-3 py-2.5">
        <p className="text-[11px] font-medium">{t("emails.preview.linksTitle")}</p>
        {links.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{t("emails.preview.noLinks")}</p>
        ) : (
          <>
            <ul className="mt-1.5 flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href} className="flex min-w-0 items-baseline gap-2 text-[11px]">
                  <span className="shrink-0 font-medium">{link.text}</span>
                  <span className="min-w-0 truncate font-mono text-muted-foreground">
                    {link.href}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {t("emails.preview.linksHint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** The editor's live preview of the selected template, with a desktop/mobile size toggle. */
export function EmailPreviewPanel({
  draft,
  locale,
  template,
  brand,
}: {
  draft: EmailTemplateInput;
  locale: string;
  template: EmailTemplate;
  brand: EmailBrand;
}) {
  const { t } = useTranslation("organizations");
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const tenantDelivery =
    template.delivery_scope === "tenant" || ["invite", "magic_link"].includes(template.key);

  return (
    <aside
      className="min-w-0 border-t border-border/60 p-3 @min-[800px]/emails:border-s @min-[800px]/emails:border-t-0"
      aria-label={t("emails.previewPanel")}
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">{t("emails.livePreview")}</h3>
          <p className="mt-1 text-[10px] text-muted-foreground">{t("emails.previewDescription")}</p>
        </div>
        <fieldset
          aria-label={t("emails.previewSize")}
          className="inline-flex rounded-md border border-border/60 bg-muted/25 p-0.5"
        >
          {(["desktop", "mobile"] as const).map((value) => {
            const Icon = value === "desktop" ? MonitorIcon : SmartphoneIcon;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1 rounded px-1.5 text-[9px] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:min-h-11",
                  mode === value
                    ? "bg-primary/8 text-primary ring-1 ring-primary/20"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-3" aria-hidden="true" />
                {t(`emails.${value}`)}
              </button>
            );
          })}
        </fieldset>
      </div>
      <EmailPreview
        draft={draft}
        locale={locale}
        variables={template.variables}
        brand={brand}
        mode={mode}
        title={t("emails.previewTitle", { name: template.name })}
      />
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
        {t(tenantDelivery ? "emails.delivery.tenant" : "emails.delivery.platform")}
      </p>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] min-w-0 overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("emails.previewAll")}</DialogTitle>
          <DialogDescription>{t("emails.previewAllDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((item) => {
            const previewDraft = drafts[item.key] ?? emailTemplateInput(saved[item.key] ?? item);
            return (
              <section key={item.key} className="min-w-0 space-y-2">
                <h3 className="text-sm font-medium">{item.name}</h3>
                <EmailPreview
                  draft={previewDraft}
                  locale={previewDraft.options.default_locale ?? "en"}
                  variables={item.variables}
                  brand={brand}
                  title={t("emails.previewTitle", { name: item.name })}
                />
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
