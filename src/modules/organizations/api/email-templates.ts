// The server holds the email template catalog (keys, default subject and body, variables); a
// tenant stores overrides, and a template without one (custom=false) uses the default.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { z } from "zod";

import i18n from "@/i18n";
import { assured, assuredItems } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

// The catalogue's own fields, always sent (email.go) though the document leaves them optional.
const templateList = assuredItems<Answer<"/v1/organizations/{organizationID}/email-templates">>()(
  "key",
  "name",
  "description",
  "variables",
  "custom",
);

// A saved or reset template answers the same record, held to the same fields.
const TEMPLATE_PATH = "/v1/organizations/{organizationID}/email-templates/{key}" as const;
const savedTemplate = assured<Answer<typeof TEMPLATE_PATH, "put">>()(
  "key",
  "name",
  "description",
  "variables",
  "custom",
);
const resetTemplate = assured<Answer<typeof TEMPLATE_PATH, "delete">>()(
  "key",
  "name",
  "description",
  "variables",
  "custom",
);

/** One email template: the catalogue's entry with the organisation's override, if any. */
export type EmailTemplate = z.output<typeof templateList>["items"][number];
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

/** True for a template the organisation's own sender delivers (invite, magic link). */
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
        schema: templateList,
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
    schema: savedTemplate,
  });
}

export function resetEmailTemplate(organizationId: string, key: string) {
  return backend.delete(TEMPLATE_PATH, {
    path: { organizationID: organizationId, key },
    schema: resetTemplate,
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
