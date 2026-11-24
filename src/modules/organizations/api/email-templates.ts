// The server holds the email template catalog (keys, default subject and body, variables); a
// tenant stores overrides, and a template without one (custom=false) uses the default.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import i18n from "@/i18n";
import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

const TEMPLATE_PATH = "/v1/organizations/{organizationID}/email-templates/{key}" as const;

/** One email template: the catalogue's entry with the organisation's override, if any. */
export type EmailTemplate =
  Answer<"/v1/organizations/{organizationID}/email-templates">["items"][number];
export type EmailTemplateInput = Body<
  "/v1/organizations/{organizationID}/email-templates/{key}",
  "put"
> & { options: EmailTemplateOptions };
export type EmailTemplateOptions = NonNullable<
  Body<"/v1/organizations/{organizationID}/email-templates/{key}", "put">["options"]
>;
export type EmailTemplateTranslation = NonNullable<EmailTemplateOptions["translations"]>[string];
export type EmailTemplateCapabilities = NonNullable<
  Answer<"/v1/organizations/{organizationID}/email-templates">["capabilities"]
>;

/** True for a template sent in the organization's own version. */
export const sentByOrganization = (template: EmailTemplate) =>
  template.delivery_scope === "organization";

export function useEmailTemplates(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: orgKeys.emailTemplates(organizationId),
    enabled: !!organizationId && enabled,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/email-templates", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}

export function useUpsertEmailTemplate() {
  const organizationId = useOrganizationId();
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
      backend.put("/v1/organizations/{organizationID}/email-templates/{key}", {
        path: { organizationID: organizationId ?? "", key },
        body: { subject, body, options },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.emailTemplates(organizationId) }),
    meta: { successMessage: "organizations:toast.templateSaved" },
  });
}

export function useResetEmailTemplate() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      backend.delete("/v1/organizations/{organizationID}/email-templates/{key}", {
        path: { organizationID: organizationId ?? "", key },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.emailTemplates(organizationId) }),
    meta: { successMessage: "organizations:toast.revertedToDefault" },
  });
}

export function usePreviewEmailTemplate() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: ({ key, vars }: { key: string; vars: Record<string, string> }) =>
      backend.post("/v1/organizations/{organizationID}/email-templates/{key}/preview", {
        path: { organizationID: organizationId ?? "", key },
        body: { vars },
      }),
    meta: { silent: true },
  });
}

/** A representative sample value for a template variable, used in previews. */
export function sampleVar(name: string): string {
  if (name.endsWith("_url")) return "https://example.invalid/test/preview";
  if (name === "code") return "482913";
  if (name === "ttl") return i18n.t("organizations:emails.sample.ttl");
  if (name === "organization_name") return i18n.t("organizations:emails.sample.organizationName");
  return name;
}

export function saveEmailTemplate(organizationId: string, key: string, draft: EmailTemplateInput) {
  return backend.put(TEMPLATE_PATH, {
    path: { organizationID: organizationId, key },
    body: draft,
  });
}

export function resetEmailTemplate(organizationId: string, key: string) {
  return backend.delete(TEMPLATE_PATH, {
    path: { organizationID: organizationId, key },
  });
}

export function testEmailTemplate(
  organizationId: string,
  key: string,
  draft: EmailTemplateInput,
  locale: string,
) {
  return backend.post("/v1/organizations/{organizationID}/email-templates/{key}/test", {
    path: { organizationID: organizationId, key },
    body: { draft, locale },
  });
}
