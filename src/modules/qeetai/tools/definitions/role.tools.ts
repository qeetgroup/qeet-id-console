// run() calls the backend through api(), so its RBAC, RLS and audit apply.

import { z } from "zod";
import { authzKeys } from "@/modules/authorization";
import { userKeys } from "@/modules/users";

import i18n from "@/i18n";
import type { ToolDefinition } from "../types/tool.types";
import { backend } from "@/platform/api/backend";

const createRoleInput = z.object({
  name: z.string(),
  description: z.string().optional(),
});
type CreateRoleInput = z.infer<typeof createRoleInput>;

export const createRoleTool: ToolDefinition<CreateRoleInput> = {
  name: "create_role",
  category: "directory",
  title: "qeetai:tools.titles.createRole",
  description:
    "Create a role in the current organization. Permissions are granted separately with grant_permission.",
  input: createRoleInput,
  requiredCapability: "role.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.roles", to: "/authorization/roles" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.createRole"),
    body: i18n.t("qeetai:tools.confirm.createRole.body"),
    affected: [{ label: i18n.t("qeetai:tools.fields.roleName"), value: input.name }],
    confirmText: i18n.t("qeetai:tools.titles.createRole"),
    tone: "default",
  }),
  auditLabel: "qeetai.create_role",
  async run(ctx, input) {
    const role = await backend.post("/v1/organizations/{organizationID}/roles", {
      path: { organizationID: ctx.organizationId },
      body: { name: input.name, description: input.description ?? "" },
      signal: ctx.signal,
    });
    void ctx.queryClient.invalidateQueries({ queryKey: authzKeys.roles(ctx.organizationId) });
    const id = role.id ?? "";
    return {
      ok: true,
      summary: `Role "${input.name}" created (id: ${id}).`,
      display: { key: "qeetai:toolCallCard.results.roleCreated", values: { name: input.name } },
      data: { id, name: input.name, description: input.description ?? "" },
    };
  },
};

const assignRoleInput = z.object({
  user_id: z.string(),
  role_id: z.string(),
});
type AssignRoleInput = z.infer<typeof assignRoleInput>;

export const assignRoleTool: ToolDefinition<AssignRoleInput> = {
  name: "assign_role",
  category: "directory",
  title: "qeetai:tools.titles.assignRole",
  description: "Assign an existing role to a user within the current organization.",
  input: assignRoleInput,
  requiredCapability: "role.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.users", to: "/users" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.confirm.assignRole.title"),
    body: i18n.t("qeetai:tools.confirm.assignRole.body"),
    affected: [
      { label: i18n.t("qeetai:tools.fields.user"), value: input.user_id },
      { label: i18n.t("qeetai:tools.fields.role"), value: input.role_id },
    ],
    confirmText: i18n.t("qeetai:tools.confirm.assignRole.title"),
    tone: "destructive",
  }),
  auditLabel: "qeetai.assign_role",
  async run(ctx, input) {
    await backend.post("/v1/users/{userID}/organizations/{organizationID}/roles/{roleID}", {
      path: { userID: input.user_id, organizationID: ctx.organizationId, roleID: input.role_id },
      signal: ctx.signal,
    });
    void ctx.queryClient.invalidateQueries({ queryKey: userKeys.organization(ctx.organizationId) });
    return {
      ok: true,
      summary: `Role ${input.role_id} assigned to user ${input.user_id} in tenant ${ctx.organizationId}.`,
      display: {
        key: "qeetai:toolCallCard.results.roleAssigned",
        values: { roleId: input.role_id, userId: input.user_id },
      },
      data: { user_id: input.user_id, role_id: input.role_id, organization_id: ctx.organizationId },
    };
  },
};

const grantPermissionInput = z.object({
  role_id: z.string(),
  permission_id: z.string(),
});
type GrantPermissionInput = z.infer<typeof grantPermissionInput>;

export const grantPermissionTool: ToolDefinition<GrantPermissionInput> = {
  name: "grant_permission",
  category: "directory",
  title: "qeetai:tools.titles.grantPermission",
  description: "Grant a permission to a role. Broadens what every user holding the role can do.",
  input: grantPermissionInput,
  requiredCapability: "role.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.roles", to: "/authorization/roles" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.grantPermission"),
    body: i18n.t("qeetai:tools.confirm.grantPermission.body"),
    affected: [
      { label: i18n.t("qeetai:tools.fields.role"), value: input.role_id },
      { label: i18n.t("qeetai:tools.fields.permission"), value: input.permission_id },
    ],
    confirmText: i18n.t("qeetai:tools.confirm.grantPermission.action"),
    tone: "destructive",
  }),
  auditLabel: "qeetai.grant_permission",
  async run(ctx, input) {
    await backend.post("/v1/roles/{roleID}/permissions/{permID}", {
      path: { roleID: input.role_id, permID: input.permission_id },
      signal: ctx.signal,
    });
    void ctx.queryClient.invalidateQueries({
      queryKey: authzKeys.rolePermissions(ctx.organizationId, input.role_id),
    });
    return {
      ok: true,
      summary: `Permission ${input.permission_id} granted to role ${input.role_id}.`,
      display: {
        key: "qeetai:toolCallCard.results.permissionGranted",
        values: { permission: input.permission_id, roleId: input.role_id },
      },
      data: { role_id: input.role_id, permission_id: input.permission_id },
    };
  },
};
