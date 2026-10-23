import { Button, cn, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { EyeIcon, LoaderCircleIcon, MailIcon, RefreshCwIcon, SendIcon } from "@qeetrix/icons";
import { useEffect, useId, useRef, useState } from "react";
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
import { orgKeys } from "../api/keys";
import {
  type EmailBrand,
  emailDraftErrors,
  emailLocaleContent,
  emailTemplateInput,
  updateEmailLocale,
} from "../email-template-model";
import { EmailTemplateEditor } from "./email-templates-page-editor";
import { EmailSaveBar, EmailSummaryCards } from "./email-templates-page-footer";
import { EmailTemplateList } from "./email-templates-page-list";
import { EmailPreviewAllDialog } from "./email-templates-page-preview";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

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
      orgKeys.emailTemplates(tenantId),
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
          actionLabel: t("emails.save").toLowerCase(),
          run: () => saveEmailTemplate(requireScope(), key, draft),
        });
        if (!result) throw new SensitiveActionCancelled();
        cache(result);
        return result;
      }}
      onReset={async (key) => {
        const result = await sensitive({
          capability: "branding.write",
          actionLabel: t("emails.reset").toLowerCase(),
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
          actionLabel: t("emails.test").toLowerCase(),
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

function EmailWorkspace(props: EmailTemplatesViewProps) {
  const firstTemplate = props.templates[0]; // the view renders this only with templates
  if (!firstTemplate) throw new Error("EmailWorkspace rendered without any email templates");
  const { t, i18n } = useTranslation("settings");
  const id = useId();
  const [selectedKey, setSelectedKey] = useState(firstTemplate.key);
  const [saved, setSaved] = useState<Record<string, EmailTemplate>>(() =>
    Object.fromEntries(props.templates.map((item) => [item.key, item])),
  );
  const [drafts, setDrafts] = useState<Record<string, EmailTemplateInput>>({});
  const [locale, setLocale] = useState("en");
  const [previewAll, setPreviewAll] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const busy = useRef(false);
  const template = saved[selectedKey] ?? firstTemplate;
  const draft = drafts[template.key] ?? emailTemplateInput(template);
  const currentLocale = locale === "en" || draft.options.translations?.[locale] ? locale : "en";
  const content = emailLocaleContent(draft, currentLocale);
  const dirty = JSON.stringify(draft) !== JSON.stringify(emailTemplateInput(template));
  const anyDirty = Object.entries(drafts).some(([key, value]) => {
    const stored = saved[key];
    return stored && JSON.stringify(value) !== JSON.stringify(emailTemplateInput(stored));
  });
  const errors = emailDraftErrors(draft, template.variables);
  const modern = props.capabilities?.rich_text === true;
  const testable = !!props.capabilities?.test_email && !!props.recipient;
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
  function discard(key: string) {
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }
  function accept(result: EmailTemplate) {
    setSaved((previous) => ({ ...previous, [result.key]: result }));
    discard(result.key);
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
          {/* Focusable while the test can't run, so a keyboard user can reach the reason. */}
          <TooltipTrigger
            render={<span tabIndex={!testable ? 0 : undefined} className="inline-flex" />}
          >
            <Button
              variant="outline"
              className={cn(ACTION, "bg-card/80")}
              disabled={disabled || !testable || errors.length > 0}
              onClick={() => void run("test")}
            >
              {pending === "test" ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
              {t("emails.test")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(testable ? "emails.testRecipient" : "emails.testUnavailable", {
              email: props.recipient,
            })}
          </TooltipContent>
        </Tooltip>
      </EmailPageHeading>
      <div className="grid min-w-0 items-stretch gap-3 @min-[640px]/emails:grid-cols-[190px_minmax(0,1fr)] @min-[1180px]/emails:grid-cols-[210px_minmax(0,1fr)]">
        <EmailTemplateList
          id={id}
          templates={props.templates}
          selectedKey={template.key}
          drafts={drafts}
          saved={saved}
          disabled={!!pending}
          onSelect={(key) => {
            setSelectedKey(key);
            setLocale("en");
            setError(null);
            setFeedback(null);
          }}
        />
        <EmailTemplateEditor
          id={id}
          template={template}
          draft={draft}
          content={content}
          currentLocale={currentLocale}
          errors={errors}
          modern={modern}
          disabled={disabled}
          capabilities={props.capabilities}
          brand={props.brand}
          localeName={localeName}
          onLocaleChange={setLocale}
          onChange={change}
          onUpdate={update}
          onReset={() => void run("reset")}
        />
      </div>
      <EmailSummaryCards
        brandName={props.brand.name}
        locales={1 + Object.keys(draft.options.translations ?? {}).length}
      />
      <EmailSaveBar
        error={error}
        feedback={feedback}
        dirty={dirty}
        disabled={disabled}
        invalid={errors.length > 0}
        saving={pending === "save"}
        onDiscard={() => {
          discard(template.key);
          setError(null);
          setFeedback(null);
        }}
        onSave={() => void run("save")}
      />
      <EmailPreviewAllDialog
        open={previewAll}
        onOpenChange={setPreviewAll}
        templates={props.templates}
        drafts={drafts}
        saved={saved}
        brand={props.brand}
      />
    </div>
  );
}
