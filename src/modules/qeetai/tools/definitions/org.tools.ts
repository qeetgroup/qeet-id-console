// run() calls the backend through api(), so its RBAC, RLS and audit apply.

import { z } from "zod";
import { orgKeys } from "@/modules/organizations";

import i18n from "@/i18n";
import type { ToolDefinition } from "../types/tool.types";
import { backend } from "@/platform/api/backend";

// The server requires the slug (its address), so the assistant asks for one rather than guess it.
const createOrgInput = z.object({
  name: z.string(),
  slug: z.string(),
});
type CreateOrgInput = z.infer<typeof createOrgInput>;

export const createOrganizationTool: ToolDefinition<CreateOrgInput> = {
  name: "create_organization",
  category: "directory",
  title: "qeetai:tools.titles.createOrganization",
  description:
    "Create a new organization, on the Free plan, with its name and slug (lowercase letters, digits and hyphens). The person moves into it.",
  input: createOrgInput,
  requiredCapability: "organization.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.organizations", to: "/organizations" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.createOrganization"),
    body: i18n.t("qeetai:tools.confirm.createOrganization.body"),
    affected: [
      { label: i18n.t("qeetai:tools.fields.name"), value: input.name },
      { label: i18n.t("qeetai:tools.fields.slug"), value: input.slug },
    ],
    confirmText: i18n.t("qeetai:tools.titles.createOrganization"),
    tone: "default",
  }),
  auditLabel: "qeetai.create_organization",
  async run(ctx, input) {
    const created = await backend.post("/v1/organizations", { body: input, signal: ctx.signal });
    ctx.queryClient.invalidateQueries({ queryKey: orgKeys.all });
    const id = created.organization?.id ?? created.organization_id ?? "";
    return {
      ok: true,
      summary: `Organization "${input.name}" created (id: ${id}, slug: ${input.slug}).`,
      display: {
        key: "qeetai:toolCallCard.results.organizationCreated",
        values: { name: input.name },
      },
      data: { id, name: input.name, slug: input.slug },
    };
  },
};
