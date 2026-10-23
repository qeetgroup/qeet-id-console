// run() calls the backend through api(), so its RBAC, RLS and audit apply.

import { z } from "zod";
import { orgKeys } from "@/modules/organizations";

import i18n from "@/i18n";
import { api } from "@/platform/api/client";
import type { ToolDefinition } from "../types/tool.types";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

const createOrgInput = z.object({
  name: z.string(),
  slug: z.string().optional(),
});
type CreateOrgInput = z.infer<typeof createOrgInput>;

export const createOrganizationTool: ToolDefinition<CreateOrgInput> = {
  name: "create_organization",
  category: "directory",
  title: "qeetai:tools.titles.createOrganization",
  description: "Create a new organization (tenant).",
  input: createOrgInput,
  requiredCapability: "tenant.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.organizations", to: "/organizations" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.createOrganization"),
    body: i18n.t("qeetai:tools.confirm.createOrganization.body"),
    affected: [
      { label: i18n.t("qeetai:tools.fields.name"), value: input.name },
      ...(input.slug ? [{ label: i18n.t("qeetai:tools.fields.slug"), value: input.slug }] : []),
    ],
    confirmText: i18n.t("qeetai:tools.titles.createOrganization"),
    tone: "default",
  }),
  auditLabel: "qeetai.create_organization",
  async run(ctx, input) {
    const tenant = await api<Tenant>("/v1/tenants", {
      method: "POST",
      body: input,
      signal: ctx.signal,
    });
    ctx.queryClient.invalidateQueries({ queryKey: orgKeys.all });
    return {
      ok: true,
      summary: `Organization "${tenant.name}" created (id: ${tenant.id}, slug: ${tenant.slug}).`,
      data: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  },
};
