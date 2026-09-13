import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Skeleton,
  StatusPill,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  ArrowUpRightIcon,
  BracesIcon,
  CheckCircle2Icon,
  EyeIcon,
  GlobeIcon,
  KeyRoundIcon,
  LinkIcon,
  Loader2Icon,
  MailIcon,
  MonitorIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SendIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  Trash2Icon,
  UserRoundPlusIcon,
} from "lucide-react";
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBranding } from "@/modules/branding";
import { useMe, useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type EmailTemplate,
  type EmailTemplateCapabilities,
  type EmailTemplateInput,
  type EmailTemplateTranslation,
  resetEmailTemplate,
  saveEmailTemplate,
  testEmailTemplate,
  useEmailTemplates,
} from "../api/email-templates";
import {
  EMAIL_LOCALES,
  type EmailBrand,
  emailDraftErrors,
  emailHTMLText,
  emailLocaleContent,
  emailPreviewDocument,
  emailPreviewHeader,
  emailPreviewLinks,
  emailTemplateInput,
  emailTextHTML,
  sanitizeEmailHTML,
  updateEmailLocale,
} from "../email-template-model";
import { EmailBodyEditor, type EmailBodyEditorHandle } from "./email-body-editor";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const INPUT =
  "h-8 min-w-0 rounded-md bg-background/25 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";
const ICONS: Record<string, typeof MailIcon> = {
  verify_email: MailIcon,
  password_reset: KeyRoundIcon,
  magic_link: LinkIcon,
  invite: UserRoundPlusIcon,
  mfa_otp: ShieldCheckIcon,
};
const TABS = ["content", "design", "localization", "advanced"] as const;

export type EmailTemplatesViewProps = {
  templates: EmailTemplate[];
  capabilities?: EmailTemplateCapabilities;
  brand: EmailBrand;
  recipient?: string;
  canRead: boolean;
  canWrite: boolean;
  loading: boolean;
  error: boolean;
  fetching: boolean;
  onRetry: () => unknown;
  onSave: (key: string, draft: EmailTemplateInput) => Promise<EmailTemplate>;
  onReset: (key: string) => Promise<EmailTemplate>;
  onTest: (
    key: string,
    draft: EmailTemplateInput,
    locale: string,
  ) => Promise<{ status: "accepted" }>;
  onDirtyChange?: (dirty: boolean) => void;
};

export function EmailTemplatesPage({
  onDirtyChange,
}: Pick<EmailTemplatesViewProps, "onDirtyChange">) {
  const { t } = useTranslation("settings");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canRead = !!tenantId && access.state === "ready" && access.can("branding.write");
  const list = useEmailTemplates(canRead);
  const branding = useBranding(canRead && access.can("tenant.read"));
  const me = useMe();
  const sensitive = useSensitiveAction();
  const queryClient = useQueryClient();
  const active = useRef<{ tenantId: string | null; canWrite: boolean } | null>(null);
  useEffect(() => {
    active.current = { tenantId, canWrite: canRead };
    return () => {
      active.current = null;
    };
  }, [tenantId, canRead]);
  function requireScope() {
    if (!tenantId || active.current?.tenantId !== tenantId || !active.current.canWrite)
      throw new SensitiveActionCancelled();
    return tenantId;
  }
  function cache(template: EmailTemplate) {
    queryClient.setQueryData<{ items: EmailTemplate[]; capabilities?: EmailTemplateCapabilities }>(
      ["email-templates", tenantId],
      (previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.map((item) => (item.key === template.key ? template : item)),
            }
          : previous,
    );
  }
  return (
    <EmailTemplatesView
      key={`${tenantId}:${canRead}`}
      templates={canRead && !list.isError ? (list.data?.items ?? []) : []}
      capabilities={list.data?.capabilities}
      brand={{
        name: branding.data?.email_from_name || "Qeet ID",
        logo: branding.data?.logo_url ?? undefined,
        primary: branding.data?.primary_color ?? undefined,
      }}
      recipient={me.data?.email_verified_at ? me.data.email : undefined}
      canRead={canRead}
      canWrite={canRead}
      loading={access.state === "resolving" || (canRead && list.isPending)}
      error={list.isError}
      fetching={list.isFetching}
      onRetry={list.refetch}
      onDirtyChange={onDirtyChange}
      onSave={async (key, draft) => {
        const result = await sensitive({
          capability: "branding.write",
          actionLabel: t("emails.save"),
          run: () => saveEmailTemplate(requireScope(), key, draft),
        });
        if (!result) throw new SensitiveActionCancelled();
        cache(result);
        return result;
      }}
      onReset={async (key) => {
        const result = await sensitive({
          capability: "branding.write",
          actionLabel: t("emails.reset"),
          confirm: {
            title: t("emails.resetTitle"),
            description: t("emails.resetDescription"),
            confirmLabel: t("emails.reset"),
            tone: "destructive",
          },
          run: () => resetEmailTemplate(requireScope(), key),
        });
        if (!result) throw new SensitiveActionCancelled();
        cache(result);
        return result;
      }}
      onTest={async (key, draft, locale) => {
        const result = await sensitive({
          capability: "branding.write",
          actionLabel: t("emails.test"),
          confirm: {
            title: t("emails.testTitle"),
            description: t("emails.testDescription", { email: me.data?.email }),
            confirmLabel: t("emails.testSend"),
            tone: "default",
          },
          run: () => testEmailTemplate(requireScope(), key, draft, locale),
        });
        if (!result) throw new SensitiveActionCancelled();
        return result;
      }}
    />
  );
}

export function EmailTemplatesView(props: EmailTemplatesViewProps) {
  const { t } = useTranslation("settings");
  if (props.loading || props.error || !props.canRead || props.templates.length === 0)
    return (
      <div className="min-w-0 space-y-5">
        <EmailPageHeading />
        {props.loading ? (
          <div
            role="status"
            aria-label={t("emails.loading")}
            className="grid gap-3 sm:grid-cols-[200px_1fr]"
          >
            <Skeleton className="h-112 rounded-lg" />
            <Skeleton className="h-112 rounded-lg" />
          </div>
        ) : (
          <section
            className={cn(
              SURFACE,
              "grid min-h-80 place-content-center justify-items-center gap-3 p-6 text-center",
            )}
          >
            <MailIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-base font-semibold">
              {t(
                !props.canRead
                  ? "emails.noAccess"
                  : props.error
                    ? "emails.loadError"
                    : "emails.empty",
              )}
            </h2>
            {props.canRead && props.error && (
              <Button
                variant="outline"
                className={ACTION}
                disabled={props.fetching}
                onClick={() => void props.onRetry()}
              >
                <RefreshCwIcon />
                {t("emails.retry")}
              </Button>
            )}
          </section>
        )}
      </div>
    );
  return <EmailWorkspace {...props} />;
}

function EmailPageHeading({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation("settings");
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <h1 className="font-heading text-[28px] leading-9 font-semibold">{t("emails.title")}</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
          {t("emails.description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </header>
  );
}

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
  const { t } = useTranslation("settings");
  const [document, setDocument] = useState("");
  useEffect(() => {
    setDocument(emailPreviewDocument(draft, locale, variables, brand));
  }, [draft, locale, variables, brand]);

  // The subject and preheader are what a recipient actually sees first, in the
  // message list, before they open anything. Showing them as an inbox row makes
  // the preview answer "how does this land?" rather than only "how does the
  // body look?" — and it's where a too-long subject or an empty preheader
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
              // Taller than the old h-87: a real template needs room before the
              // reader has to scroll inside a preview.
              mode === "mobile" ? "h-120 max-w-[22rem]" : "h-140",
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

function EmailWorkspace(props: EmailTemplatesViewProps) {
  const { t, i18n } = useTranslation("settings");
  const id = useId();
  const [selectedKey, setSelectedKey] = useState(props.templates[0].key);
  const [saved, setSaved] = useState<Record<string, EmailTemplate>>(() =>
    Object.fromEntries(props.templates.map((item) => [item.key, item])),
  );
  const [drafts, setDrafts] = useState<Record<string, EmailTemplateInput>>({});
  const [tab, setTab] = useState<(typeof TABS)[number]>("content");
  const [locale, setLocale] = useState("en");
  const [newLocale, setNewLocale] = useState("fr");
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [previewAll, setPreviewAll] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const busy = useRef(false);
  const editorRef = useRef<EmailBodyEditorHandle>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const preheaderRef = useRef<HTMLInputElement>(null);
  const activeField = useRef<"subject" | "preheader" | "body">("body");
  const template = saved[selectedKey] ?? props.templates[0];
  const draft = drafts[template.key] ?? emailTemplateInput(template);
  const currentLocale = locale === "en" || draft.options.translations?.[locale] ? locale : "en";
  const content = emailLocaleContent(draft, currentLocale);
  const dirty = JSON.stringify(draft) !== JSON.stringify(emailTemplateInput(template));
  const anyDirty = Object.entries(drafts).some(
    ([key, value]) =>
      saved[key] && JSON.stringify(value) !== JSON.stringify(emailTemplateInput(saved[key])),
  );
  const errors = emailDraftErrors(draft, template.variables);
  const modern = props.capabilities?.rich_text === true;
  const tenantDelivery =
    template.delivery_scope === "tenant" || ["invite", "magic_link"].includes(template.key);
  const disabled = !props.canWrite || !!pending;
  const localeName = (code: string) =>
    new Intl.DisplayNames([i18n.language], { type: "language" }).of(code) ?? code;

  useEffect(() => {
    setSaved(Object.fromEntries(props.templates.map((item) => [item.key, item])));
  }, [props.templates]);
  useEffect(() => {
    props.onDirtyChange?.(anyDirty);
    return () => props.onDirtyChange?.(false);
  }, [anyDirty, props.onDirtyChange]);

  function change(next: EmailTemplateInput) {
    if (disabled) return;
    setDrafts((previous) => ({ ...previous, [template.key]: next }));
    setFeedback(null);
    setError(null);
  }
  function update(patch: Partial<EmailTemplateTranslation>) {
    change(updateEmailLocale(draft, currentLocale, patch));
  }
  function fieldChange(key: "subject" | "preheader") {
    return (event: ChangeEvent<HTMLInputElement>) => update({ [key]: event.target.value });
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
    update({ [field]: target.value.slice(0, start) + token + target.value.slice(end) });
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  }
  function accept(result: EmailTemplate) {
    setSaved((previous) => ({ ...previous, [result.key]: result }));
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[result.key];
      return next;
    });
  }
  async function run(kind: "save" | "reset" | "test") {
    if (busy.current || !props.canWrite || (kind !== "reset" && errors.length)) return;
    busy.current = true;
    setPending(kind);
    setError(null);
    setFeedback(null);
    try {
      if (kind === "save") {
        accept(await props.onSave(template.key, draft));
        setFeedback(t("emails.saved"));
      }
      if (kind === "reset") {
        accept(await props.onReset(template.key));
        setLocale("en");
        setFeedback(t("emails.resetDone"));
      }
      if (kind === "test") {
        const result = await props.onTest(template.key, draft, currentLocale);
        if (result.status === "accepted") setFeedback(t("emails.testAccepted"));
        else throw new Error("Test email was not accepted");
      }
    } catch (failure) {
      if (!(failure instanceof SensitiveActionCancelled)) setError(errorMessage(failure));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <div className="@container/emails relative isolate flex min-w-0 flex-col gap-4 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-8 dark:before:opacity-4">
      <EmailPageHeading>
        <Button
          variant="outline"
          className={cn(ACTION, "bg-card/80")}
          onClick={() => setPreviewAll(true)}
        >
          <EyeIcon />
          {t("emails.previewAll")}
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                tabIndex={!props.capabilities?.test_email ? 0 : undefined}
                className="inline-flex"
              />
            }
          >
            <Button
              variant="outline"
              className={cn(ACTION, "bg-card/80")}
              disabled={
                disabled || !props.capabilities?.test_email || !props.recipient || errors.length > 0
              }
              onClick={() => void run("test")}
            >
              {pending === "test" ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              {t("emails.test")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(
              props.capabilities?.test_email && props.recipient
                ? "emails.testRecipient"
                : "emails.testUnavailable",
              { email: props.recipient },
            )}
          </TooltipContent>
        </Tooltip>
      </EmailPageHeading>
      <div className="grid min-w-0 items-stretch gap-3 @min-[640px]/emails:grid-cols-[190px_minmax(0,1fr)] @min-[1180px]/emails:grid-cols-[210px_minmax(0,1fr)]">
        <section className={cn(SURFACE, "p-3")} aria-labelledby={`${id}-templates`}>
          <h2 id={`${id}-templates`} className="font-heading text-sm font-semibold">
            {t("emails.list")}{" "}
            <span className="font-normal text-muted-foreground">({props.templates.length})</span>
          </h2>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            {t("emails.listDescription")}
          </p>
          <nav
            aria-label={t("emails.list")}
            className="mt-3 grid gap-1 @max-[639px]/emails:grid-cols-2"
          >
            {props.templates.map((item) => {
              const Icon = ICONS[item.key] ?? MailIcon;
              const active = item.key === template.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  disabled={!!pending}
                  onClick={() => {
                    setSelectedKey(item.key);
                    setLocale("en");
                    setError(null);
                    setFeedback(null);
                  }}
                  className={cn(
                    "flex min-w-0 cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring disabled:opacity-50",
                    active ? "bg-primary/8 text-foreground" : "hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-md",
                      active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold leading-4">{item.name}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                      {item.description}
                    </span>
                    {drafts[item.key] &&
                      JSON.stringify(drafts[item.key]) !==
                        JSON.stringify(emailTemplateInput(saved[item.key] ?? item)) && (
                        <span className="mt-1 block text-[9px] font-medium text-primary">
                          {t("emails.unsaved")}
                        </span>
                      )}
                  </span>
                </button>
              );
            })}
          </nav>
        </section>
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
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                {template.description}
              </p>
            </div>
            <Button
              variant="outline"
              className={cn(ACTION, "h-7 px-2 text-[10px]")}
              disabled={disabled || !template.custom}
              onClick={() => void run("reset")}
            >
              <RotateCcwIcon className="size-3" />
              {t("emails.reset")}
            </Button>
          </div>
          <div
            role="tablist"
            aria-label={t("emails.editorTabs")}
            className="flex min-w-0 overflow-x-auto border-b border-border/60 px-2"
          >
            {TABS.map((value, index) => (
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
                        ? TABS.length - 1
                        : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
                          TABS.length;
                  setTab(TABS[next]);
                  document.getElementById(`${id}-${TABS[next]}-tab`)?.focus();
                }}
                onClick={() => setTab(value)}
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
          <div className="grid min-w-0 flex-1 @min-[800px]/emails:grid-cols-[minmax(0,1.2fr)_minmax(210px,0.9fr)]">
            <div
              role="tabpanel"
              id={`${id}-tabpanel`}
              aria-labelledby={`${id}-${tab}-tab`}
              className="min-w-0 p-3.5"
            >
              {tab === "content" && (
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
                    <FieldLabel htmlFor={`${id}-preheader`}>
                      {t("emails.fields.preheader")}
                    </FieldLabel>
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
                          onChange={(body_html, body) => update({ body_html, body })}
                          disabled={disabled}
                        />
                      ) : (
                        <Textarea
                          aria-label={t("emails.fields.body")}
                          value={content.body}
                          onChange={(event) => update({ body: event.target.value })}
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
                      onValueChange={(value) => value && setLocale(value)}
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
              )}
              {tab === "design" && (
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
                        change({ ...draft, options: { ...draft.options, show_logo: checked } })
                      }
                    />
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-xs">{t("emails.design.alignment")}</legend>
                    <div className="inline-flex rounded-md border border-border/70 bg-muted/20 p-0.5">
                      {(["left", "center"] as const).map((alignment) => {
                        const Icon = alignment === "left" ? AlignLeftIcon : AlignCenterIcon;
                        return (
                          <button
                            key={alignment}
                            type="button"
                            aria-label={t(`emails.design.${alignment}`)}
                            title={t(`emails.design.${alignment}`)}
                            aria-pressed={draft.options.alignment === alignment}
                            disabled={disabled || !modern}
                            onClick={() =>
                              change({ ...draft, options: { ...draft.options, alignment } })
                            }
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
                          backgroundColor: /^#[\da-f]{6}$/i.test(props.brand.primary ?? "")
                            ? props.brand.primary
                            : "#f97316",
                        }}
                      />
                      <code className="text-xs text-muted-foreground">
                        {props.brand.primary || "#f97316"}
                      </code>
                    </div>
                    <a
                      href="/settings/branding"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                    >
                      {t("emails.design.manage")}
                      <ArrowUpRightIcon className="size-3" />
                    </a>
                  </div>
                </div>
              )}
              {tab === "localization" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold">{t("emails.localization.title")}</h3>
                  <div className="space-y-2">
                    {["en", ...Object.keys(draft.options.translations ?? {})].map((code) => (
                      <div
                        key={code}
                        className="flex items-center justify-between gap-2 border-b border-border/50 py-2"
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setLocale(code);
                            setTab("content");
                          }}
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
                            aria-label={t("emails.localization.remove", {
                              language: localeName(code),
                            })}
                            title={t("emails.localization.remove", { language: localeName(code) })}
                            disabled={disabled}
                            className="size-7"
                            onClick={() => {
                              const translations = { ...draft.options.translations };
                              delete translations[code];
                              change({
                                ...draft,
                                options: {
                                  ...draft.options,
                                  translations,
                                  default_locale:
                                    draft.options.default_locale === code
                                      ? "en"
                                      : draft.options.default_locale,
                                },
                              });
                            }}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={newLocale}
                      onValueChange={(value) => value && setNewLocale(value)}
                      disabled={disabled || !props.capabilities?.localization}
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
                      disabled={
                        disabled ||
                        !props.capabilities?.localization ||
                        !!draft.options.translations?.[newLocale]
                      }
                      onClick={() => {
                        change({
                          ...draft,
                          options: {
                            ...draft.options,
                            translations: {
                              ...draft.options.translations,
                              [newLocale]: { ...emailLocaleContent(draft, "en") },
                            },
                          },
                        });
                        setLocale(newLocale);
                        setTab("content");
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
                        value &&
                        change({ ...draft, options: { ...draft.options, default_locale: value } })
                      }
                      disabled={disabled || !props.capabilities?.localization}
                    >
                      <SelectTrigger id={`${id}-default-locale`} className={INPUT}>
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
                  </Field>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {t("emails.localization.note")}
                  </p>
                </div>
              )}
              {tab === "advanced" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t("emails.advanced.key")}</p>
                    <code className="mt-1 block text-xs">{template.key}</code>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`${id}-text`} className="text-xs">
                      {t("emails.advanced.text")}
                    </FieldLabel>
                    <Textarea
                      id={`${id}-text`}
                      value={content.body}
                      disabled={disabled}
                      onChange={(event) => update({ body: event.target.value })}
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
                        update({
                          body_html: event.target.value,
                          body: emailHTMLText(event.target.value),
                        })
                      }
                      onBlur={() => {
                        if (content.body_html)
                          update({ body_html: sanitizeEmailHTML(content.body_html) });
                      }}
                      className="min-h-40 font-mono text-[11px]"
                    />
                  </Field>
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    {t("emails.advanced.safety")}
                  </p>
                </div>
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
            <aside
              className="min-w-0 border-t border-border/60 p-3 @min-[800px]/emails:border-s @min-[800px]/emails:border-t-0"
              aria-label={t("emails.previewPanel")}
            >
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold">{t("emails.livePreview")}</h3>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {t("emails.previewDescription")}
                  </p>
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
                locale={currentLocale}
                variables={template.variables}
                brand={props.brand}
                mode={mode}
                title={t("emails.previewTitle", { name: template.name })}
              />
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                {t(tenantDelivery ? "emails.delivery.tenant" : "emails.delivery.platform")}
              </p>
            </aside>
          </div>
        </section>
      </div>
      <div className="grid gap-3 @min-[640px]/emails:grid-cols-3">
        {[
          { key: "brand", Icon: MailIcon, detail: props.brand.name },
          {
            key: "languages",
            Icon: GlobeIcon,
            detail: t("emails.localeCount", {
              count: 1 + Object.keys(draft.options.translations ?? {}).length,
            }),
          },
          { key: "secure", Icon: ShieldCheckIcon, detail: t("emails.selfOnly") },
        ].map(({ key, Icon, detail }) => (
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
              {feedback && <CheckCircle2Icon className="size-3.5" />}
              {feedback || t(dirty ? "emails.unsaved" : "emails.noChanges")}
            </p>
          )}
        </div>
        <div className="ms-auto flex gap-2">
          <Button
            variant="outline"
            className={ACTION}
            disabled={disabled || !dirty}
            onClick={() => {
              setDrafts((previous) => {
                const next = { ...previous };
                delete next[template.key];
                return next;
              });
              setError(null);
              setFeedback(null);
            }}
          >
            {t("emails.cancel")}
          </Button>
          <Button
            className={ACTION}
            disabled={disabled || !dirty || errors.length > 0}
            onClick={() => void run("save")}
          >
            {pending === "save" && <Loader2Icon className="animate-spin" />}
            {t(pending === "save" ? "emails.saving" : "emails.save")}
          </Button>
        </div>
      </footer>
      <Dialog open={previewAll} onOpenChange={setPreviewAll}>
        <DialogContent className="max-h-[90dvh] min-w-0 overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("emails.previewAll")}</DialogTitle>
            <DialogDescription>{t("emails.previewAllDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.templates.map((item) => {
              const previewDraft = drafts[item.key] ?? emailTemplateInput(saved[item.key] ?? item);
              return (
                <section key={item.key} className="min-w-0 space-y-2">
                  <h3 className="text-sm font-medium">{item.name}</h3>
                  <EmailPreview
                    draft={previewDraft}
                    locale={previewDraft.options.default_locale ?? "en"}
                    variables={item.variables}
                    brand={props.brand}
                    title={t("emails.previewTitle", { name: item.name })}
                  />
                </section>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
