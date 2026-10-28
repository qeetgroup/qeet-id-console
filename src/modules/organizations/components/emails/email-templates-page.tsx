import { EyeIcon, MailIcon, SendIcon } from "@qeetrix/icons";
import { Button, Tooltip } from "@qeetrix/react";
import { EmptyState, PageHeader } from "@qeetrix/react/experimental";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBranding } from "@/modules/branding";
import { PageBreadcrumb } from "@/modules/dashboard";
import {
  type EmailTemplate,
  type EmailTemplateCapabilities,
  type EmailTemplateInput,
  type EmailTemplateTranslation,
  resetEmailTemplate,
  saveEmailTemplate,
  testEmailTemplate,
  useEmailTemplates,
} from "@/modules/organizations/api/email-templates";
import { orgKeys } from "@/modules/organizations/api/keys";
import { LoadFailed, Loading } from "@/modules/organizations/components/settings/settings-parts";
import { useOrgName } from "@/modules/organizations/components/settings/use-org-name";
import {
  type EmailBrand,
  emailDraftErrors,
  emailLocaleContent,
  emailTemplateInput,
  updateEmailLocale,
} from "@/modules/organizations/email-template-model";
import { useMe, useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { EmailTemplateEditor } from "./email-editor";
import { EmailTemplateList } from "./email-list";
import { EmailPreviewAllDialog } from "./email-preview";
import "./emails.css";

export type EmailTemplatesViewProps = {
  /** The organisation's name, for the page's copy. */
  name: string;
  templates: EmailTemplate[];
  capabilities?: EmailTemplateCapabilities;
  brand: EmailBrand;
  recipient?: string;
  canRead: boolean;
  canWrite: boolean;
  loading: boolean;
  /** Why the templates didn't load, or null. */
  error: unknown;
  fetching: boolean;
  onRetry: () => unknown;
  onSave: (key: string, draft: EmailTemplateInput) => Promise<EmailTemplate>;
  onReset: (template: EmailTemplate) => Promise<EmailTemplate>;
  onTest: (
    key: string,
    draft: EmailTemplateInput,
    locale: string,
  ) => Promise<{ status: "accepted" }>;
  onDirtyChange?: (dirty: boolean) => void;
};

/**
 * Settings › Emails, wired to the server: the templates (GET needs branding.write), the brand the
 * preview uses, and saving, resetting and testing through the console's one confirm. Saving and
 * resetting need a recent second step; a test goes to your own verified address, once a minute.
 */
export function EmailTemplatesPage({
  onDirtyChange,
}: Pick<EmailTemplatesViewProps, "onDirtyChange">) {
  const { t } = useTranslation("organizations");
  const tenantId = useTenantId();
  const name = useOrgName();
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
  // A confirm still open when the organisation changes must not send to the new one.
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
      name={name}
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
      error={list.isError ? list.error : null}
      fetching={list.isFetching}
      onRetry={list.refetch}
      onDirtyChange={onDirtyChange}
      onSave={async (key, draft) => {
        const result = await sensitive({
          capability: "branding.write",
          actionLabel: t("emails.saveAction"),
          run: () => saveEmailTemplate(requireScope(), key, draft),
        });
        if (!result) throw new SensitiveActionCancelled();
        cache(result);
        return result;
      }}
      onReset={async (template) => {
        const result = await sensitive({
          capability: "branding.write",
          actionLabel: t("emails.reset"),
          confirm: {
            title: t("emails.resetTitle", { template: template.name }),
            description: t(
              template.delivery_scope === "tenant"
                ? "emails.resetDescriptionTenant"
                : "emails.resetDescriptionPlatform",
              { name },
            ),
            confirmLabel: t("emails.reset"),
            tone: "destructive",
          },
          run: () => resetEmailTemplate(requireScope(), template.key),
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

function EmailsHeader({ name, actions }: { name: string; actions?: ReactNode }) {
  const { t } = useTranslation("organizations");
  return (
    <PageHeader
      breadcrumb={<PageBreadcrumb />}
      title={t("emails.title")}
      description={t("emails.description", { name })}
      actions={actions}
    />
  );
}

/** The page in any state: loading, failed, no access or no templates, else the workspace. */
export function EmailTemplatesView(props: EmailTemplatesViewProps) {
  const { t } = useTranslation("organizations");
  if (props.canRead && !props.loading && !props.error && props.templates.length > 0)
    return <EmailWorkspace {...props} />;
  return (
    <>
      <EmailsHeader name={props.name} />
      <div className="mail-state">
        {props.loading ? (
          <Loading rows={4} />
        ) : !props.canRead ? (
          <EmptyState icon={MailIcon} title={t("emails.noAccess")} />
        ) : props.error ? (
          <LoadFailed error={props.error} onRetry={() => void props.onRetry()} />
        ) : (
          <EmptyState icon={MailIcon} title={t("emails.empty")} />
        )}
      </div>
    </>
  );
}

/**
 * The workspace: the templates in a column (the Ember bar on the open one), and the open one's
 * editor beside it — its toolbar, tabs, fields and live preview. A draft is kept per template
 * while you move between them, and survives a refetch until it's saved or discarded.
 */
function EmailWorkspace(props: EmailTemplatesViewProps) {
  const firstTemplate = props.templates[0]; // the view renders this only with templates
  if (!firstTemplate) throw new Error("EmailWorkspace rendered without any email templates");
  const { t } = useTranslation("organizations");
  const [selectedKey, setSelectedKey] = useState(firstTemplate.key);
  const [saved, setSaved] = useState<Record<string, EmailTemplate>>(() =>
    Object.fromEntries(props.templates.map((item) => [item.key, item])),
  );
  const [drafts, setDrafts] = useState<Record<string, EmailTemplateInput>>({});
  const [locale, setLocale] = useState("en");
  const [previewAll, setPreviewAll] = useState(false);
  const [pending, setPending] = useState<"save" | "reset" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const busy = useRef(false);
  const template = saved[selectedKey] ?? firstTemplate;
  const draft = drafts[template.key] ?? emailTemplateInput(template);
  const currentLocale = locale === "en" || draft.options.translations?.[locale] ? locale : "en";
  const content = emailLocaleContent(draft, currentLocale);
  const dirtyKeys = Object.entries(drafts)
    .filter(([key, value]) => {
      const stored = saved[key];
      return stored && JSON.stringify(value) !== JSON.stringify(emailTemplateInput(stored));
    })
    .map(([key]) => key);
  const dirty = dirtyKeys.includes(template.key);
  const anyDirty = dirtyKeys.length > 0;
  const errors = emailDraftErrors(draft, template.variables);
  const testable = !!props.capabilities?.test_email && !!props.recipient;
  const disabled = !props.canWrite || !!pending;

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
        accept(await props.onReset(template));
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
    <>
      <EmailsHeader
        name={props.name}
        actions={
          <>
            <Button variant="ghost" icon={EyeIcon} onClick={() => setPreviewAll(true)}>
              {t("emails.previewAll")}
            </Button>
            {/* The library Button disables with aria-disabled, so the reason stays reachable. */}
            <Tooltip
              content={t(testable ? "emails.testRecipient" : "emails.testUnavailable", {
                email: props.recipient,
              })}
            >
              <Button
                variant="soft"
                icon={SendIcon}
                loading={pending === "test"}
                disabled={disabled || !testable || errors.length > 0}
                onClick={() => void run("test")}
              >
                {t("emails.test")}
              </Button>
            </Tooltip>
          </>
        }
      />
      <div className="mail">
        <EmailTemplateList
          templates={props.templates}
          selectedKey={template.key}
          dirtyKeys={dirtyKeys}
          disabled={!!pending}
          onSelect={(key) => {
            setSelectedKey(key);
            setLocale("en");
            setError(null);
            setFeedback(null);
          }}
        />
        <EmailTemplateEditor
          name={props.name}
          template={template}
          draft={draft}
          content={content}
          currentLocale={currentLocale}
          errors={errors}
          capabilities={props.capabilities}
          brand={props.brand}
          disabled={disabled}
          dirty={dirty}
          pending={pending}
          error={error}
          feedback={feedback}
          onLocaleChange={setLocale}
          onChange={change}
          onUpdate={update}
          onSave={() => void run("save")}
          onReset={() => void run("reset")}
          onDiscard={() => {
            discard(template.key);
            setError(null);
            setFeedback(null);
          }}
        />
      </div>
      <EmailPreviewAllDialog
        open={previewAll}
        onOpenChange={setPreviewAll}
        templates={props.templates}
        drafts={drafts}
        saved={saved}
        brand={props.brand}
      />
    </>
  );
}
