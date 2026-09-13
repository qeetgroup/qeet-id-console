// Transactional email template data layer. The catalog (keys + default
// subject/body + variables) lives server-side; tenants store overrides. A
// missing override means the built-in default is used (custom=false).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface EmailTemplate {
  key: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  custom: boolean;
  options?: EmailTemplateOptions;
  delivery_scope?: "tenant" | "platform";
}

export type EmailTemplateTranslation = {
  subject: string;
  body: string;
  preheader?: string;
  body_html?: string;
};
export type EmailTemplateOptions = {
  preheader?: string;
  body_html?: string;
  default_locale?: string;
  translations?: Record<string, EmailTemplateTranslation>;
  show_logo?: boolean;
  alignment?: "left" | "center";
};
export type EmailTemplateInput = { subject: string; body: string; options: EmailTemplateOptions };
export type EmailTemplateCapabilities = {
  rich_text: boolean;
  localization: boolean;
  test_email: boolean;
};

export function useEmailTemplates(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["email-templates", tenantId],
    enabled: !!tenantId && enabled,
    queryFn: () =>
      api<{ items: EmailTemplate[]; capabilities?: EmailTemplateCapabilities }>(
        `/v1/tenants/${tenantId}/email-templates`,
      ),
  });
}

export function useUpsertEmailTemplate() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      subject,
      body,
      options,
    }: {
      key: string;
      subject: string;
      body: string;
      options?: EmailTemplateOptions;
    }) =>
      api<EmailTemplate>(`/v1/tenants/${tenantId}/email-templates/${key}`, {
        method: "PUT",
        body: { subject, body, options },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
    meta: { successMessage: "Template saved" },
  });
}

export function useResetEmailTemplate() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      api<EmailTemplate>(`/v1/tenants/${tenantId}/email-templates/${key}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
    meta: { successMessage: "Reverted to default" },
  });
}

export function usePreviewEmailTemplate() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ key, vars }: { key: string; vars: Record<string, string> }) =>
      api<{ subject: string; body: string }>(
        `/v1/tenants/${tenantId}/email-templates/${key}/preview`,
        { method: "POST", body: { vars } },
      ),
    meta: { silent: true },
  });
}

/** A representative sample value for a template variable, used in previews. */
export function sampleVar(name: string): string {
  if (name.endsWith("_url")) return "https://example.invalid/test/preview";
  if (name === "code") return "482913";
  if (name === "ttl") return "10 minutes";
  if (name === "tenant_name") return "Your organization";
  return name;
}

export function saveEmailTemplate(tenantId: string, key: string, draft: EmailTemplateInput) {
  return api<EmailTemplate>(`/v1/tenants/${tenantId}/email-templates/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: draft,
  });
}

export function resetEmailTemplate(tenantId: string, key: string) {
  return api<EmailTemplate>(`/v1/tenants/${tenantId}/email-templates/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

export function testEmailTemplate(
  tenantId: string,
  key: string,
  draft: EmailTemplateInput,
  locale: string,
) {
  return api<{ status: "accepted" }>(
    `/v1/tenants/${tenantId}/email-templates/${encodeURIComponent(key)}/test`,
    { method: "POST", body: { draft, locale } },
  );
}
