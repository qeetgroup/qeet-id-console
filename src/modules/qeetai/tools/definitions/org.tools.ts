// Organization (tenant) tools — create_organization.
//
// run() calls POST /v1/tenants via api() so RBAC + RLS + audit are inherited.

import { z } from "zod";

import { api } from "@/platform/api/client";
import type { ToolDefinition } from "../types/tool.types";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

// ── create_organization ───────────────────────────────────────────────────────

const createOrgInput = z.object({
  name: z.string(),
  slug: z.string().optional(),
});
type CreateOrgInput = z.infer<typeof createOrgInput>;

export const createOrganizationTool: ToolDefinition<CreateOrgInput> = {
  name: "create_organization",
  category: "directory",
  title: "Create organization",
  description: "Create a new organization (tenant).",
  input: createOrgInput,
  requiredCapability: "tenant.write",
  destructive: false,
  confirm: (input) => ({
    title: "Create organization",
    body: "Qeet AI will create a new organization (tenant).",
    affected: [
      { label: "Name", value: input.name },
      ...(input.slug ? [{ label: "Slug", value: input.slug }] : []),
    ],
    confirmText: "Create organization",
    tone: "default",
  }),
  auditLabel: "qeetai.create_organization",
  async run(ctx, input) {
    const tenant = await api<Tenant>("/v1/tenants", {
      method: "POST",
      body: input,
      signal: ctx.signal,
    });
    ctx.queryClient.invalidateQueries({ queryKey: ["tenants"] });
    return {
      ok: true,
      summary: `Organization "${tenant.name}" created (id: ${tenant.id}, slug: ${tenant.slug}).`,
      data: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  },
};
