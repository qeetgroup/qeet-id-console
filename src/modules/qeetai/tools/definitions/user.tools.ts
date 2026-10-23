// run() calls the backend through api(), so its RBAC, RLS and audit apply.

import { z } from "zod";

import i18n from "@/i18n";
import { api } from "@/platform/api/client";
import { type User, userKeys } from "@/modules/users";
import type { ToolDefinition } from "../types/tool.types";

const searchUsersInput = z.object({
  q: z.string().optional(),
  status: z.enum(["active", "suspended", "invited", "deleted"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
type SearchUsersInput = z.infer<typeof searchUsersInput>;

export const searchUsersTool: ToolDefinition<SearchUsersInput> = {
  name: "search_users",
  category: "directory",
  title: "qeetai:tools.titles.searchUsers",
  description:
    "Search users in the current tenant by free-text query and/or status. Returns a redacted list of users (id, email, name, status). Read-only.",
  input: searchUsersInput,
  requiredCapability: "user.read",
  destructive: false,
  mutates: false,
  auditLabel: "qeetai.search_users",
  async run(ctx, input) {
    const data = await api<{ items: User[] }>("/v1/users", {
      query: {
        q: input.q,
        status: input.status,
        limit: input.limit ?? 20,
      },
      signal: ctx.signal,
    });
    const users = data.items ?? [];
    return {
      ok: true,
      summary: `Found ${users.length} user${users.length === 1 ? "" : "s"}.`,
      display: { key: "qeetai:toolCallCard.results.usersFound", values: { count: users.length } },
      data: {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          display_name: u.display_name,
          status: u.status,
        })),
      },
    };
  },
};

const createUserInput = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8).optional(),
  tenant_id: z.string(),
  role_id: z.string().optional(),
});
type CreateUserInput = z.infer<typeof createUserInput>;

export const createUserTool: ToolDefinition<CreateUserInput> = {
  name: "create_user",
  category: "directory",
  title: "qeetai:tools.titles.createUser",
  description:
    "Create a new user in a tenant. Optionally assign an initial role. If no password is given, the user is created for invitation/passwordless onboarding.",
  input: createUserInput,
  requiredCapability: "user.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.users", to: "/users" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.createUser"),
    body: i18n.t("qeetai:tools.confirm.createUser.body"),
    affected: [
      { label: i18n.t("qeetai:tools.fields.email"), value: input.email },
      { label: i18n.t("qeetai:tools.fields.tenant"), value: input.tenant_id },
      ...(input.role_id
        ? [{ label: i18n.t("qeetai:tools.fields.initialRole"), value: input.role_id }]
        : []),
    ],
    confirmText: i18n.t("qeetai:tools.titles.createUser"),
    tone: "default",
  }),
  auditLabel: "qeetai.create_user",
  async run(ctx, input) {
    const { role_id, name, ...rest } = input;
    const user = await api<User>("/v1/users", {
      method: "POST",
      body: { ...rest, display_name: name },
      signal: ctx.signal,
    });
    if (role_id) {
      await api<void>(`/v1/users/${user.id}/tenants/${input.tenant_id}/roles/${role_id}`, {
        method: "POST",
        signal: ctx.signal,
      });
    }
    ctx.queryClient.invalidateQueries({ queryKey: userKeys.tenant(ctx.tenantId) });
    return {
      ok: true,
      summary: `Created user ${user.email} (id: ${user.id})${role_id ? " and assigned the requested role" : ""}.`,
      display: {
        key: role_id
          ? "qeetai:toolCallCard.results.userCreatedWithRole"
          : "qeetai:toolCallCard.results.userCreated",
        values: { email: user.email },
      },
      data: { id: user.id, email: user.email, status: user.status },
    };
  },
};

const updateUserInput = z.object({
  user_id: z.string(),
  name: z.string().optional(),
});
type UpdateUserInput = z.infer<typeof updateUserInput>;

export const updateUserTool: ToolDefinition<UpdateUserInput> = {
  name: "update_user",
  category: "directory",
  title: "qeetai:tools.titles.updateUser",
  description: "Update a user's mutable profile fields (currently display name).",
  input: updateUserInput,
  requiredCapability: "user.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.users", to: "/users" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.updateUser"),
    body: i18n.t("qeetai:tools.confirm.updateUser.body"),
    affected: [
      { label: i18n.t("qeetai:tools.fields.user"), value: input.user_id },
      ...(input.name
        ? [{ label: i18n.t("qeetai:tools.fields.displayName"), value: input.name }]
        : []),
    ],
    confirmText: i18n.t("qeetai:tools.titles.updateUser"),
    tone: "default",
  }),
  auditLabel: "qeetai.update_user",
  async run(ctx, input) {
    await api<User>(`/v1/users/${input.user_id}`, {
      method: "PATCH",
      body: { display_name: input.name ?? null },
      signal: ctx.signal,
    });
    ctx.queryClient.invalidateQueries({ queryKey: userKeys.tenant(ctx.tenantId) });
    return {
      ok: true,
      summary: `Updated display name for user ${input.user_id}.`,
      display: {
        key: "qeetai:toolCallCard.results.displayNameUpdated",
        values: { userId: input.user_id },
      },
      data: { user_id: input.user_id, name: input.name },
    };
  },
};

const disableUserInput = z.object({ user_id: z.string() });
type DisableUserInput = z.infer<typeof disableUserInput>;

export const disableUserTool: ToolDefinition<DisableUserInput> = {
  name: "disable_user",
  category: "directory",
  title: "qeetai:tools.titles.disableUser",
  description:
    "Suspend a user, immediately blocking their sign-in. Reversible with enable_user. Destructive: requires confirmation.",
  input: disableUserInput,
  requiredCapability: "user.write",
  destructive: true,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.users", to: "/users" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.disableUser"),
    body: i18n.t("qeetai:tools.confirm.disableUser.body"),
    affected: [{ label: i18n.t("qeetai:tools.fields.userId"), value: input.user_id }],
    confirmText: i18n.t("qeetai:tools.confirm.disableUser.action"),
    tone: "destructive",
  }),
  auditLabel: "qeetai.disable_user",
  async run(ctx, input) {
    await api<User>(`/v1/users/${input.user_id}`, {
      method: "PATCH",
      body: { status: "suspended" },
      signal: ctx.signal,
    });
    ctx.queryClient.invalidateQueries({ queryKey: userKeys.tenant(ctx.tenantId) });
    return {
      ok: true,
      summary: `User ${input.user_id} has been suspended and can no longer sign in.`,
      display: {
        key: "qeetai:toolCallCard.results.userSuspended",
        values: { userId: input.user_id },
      },
      data: { user_id: input.user_id, status: "suspended" },
    };
  },
};

const enableUserInput = z.object({ user_id: z.string() });
type EnableUserInput = z.infer<typeof enableUserInput>;

export const enableUserTool: ToolDefinition<EnableUserInput> = {
  name: "enable_user",
  category: "directory",
  title: "qeetai:tools.titles.enableUser",
  description: "Re-activate a suspended user, restoring their ability to sign in.",
  input: enableUserInput,
  requiredCapability: "user.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.users", to: "/users" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.enableUser"),
    body: i18n.t("qeetai:tools.confirm.enableUser.body"),
    affected: [{ label: i18n.t("qeetai:tools.fields.userId"), value: input.user_id }],
    confirmText: i18n.t("qeetai:tools.titles.enableUser"),
    tone: "default",
  }),
  auditLabel: "qeetai.enable_user",
  async run(ctx, input) {
    await api<User>(`/v1/users/${input.user_id}`, {
      method: "PATCH",
      body: { status: "active" },
      signal: ctx.signal,
    });
    ctx.queryClient.invalidateQueries({ queryKey: userKeys.tenant(ctx.tenantId) });
    return {
      ok: true,
      summary: `User ${input.user_id} has been re-activated and can sign in again.`,
      display: {
        key: "qeetai:toolCallCard.results.userReactivated",
        values: { userId: input.user_id },
      },
      data: { user_id: input.user_id, status: "active" },
    };
  },
};

const deleteUserInput = z.object({ user_id: z.string() });
type DeleteUserInput = z.infer<typeof deleteUserInput>;

export const deleteUserTool: ToolDefinition<DeleteUserInput> = {
  name: "delete_user",
  category: "directory",
  title: "qeetai:tools.titles.deleteUser",
  description:
    "Soft-delete a user. Destructive: requires confirmation and shows the affected user before proceeding.",
  input: deleteUserInput,
  requiredCapability: "user.write",
  destructive: true,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.users", to: "/users" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.deleteUser"),
    body: i18n.t("qeetai:tools.confirm.deleteUser.body"),
    affected: [{ label: i18n.t("qeetai:tools.fields.userId"), value: input.user_id }],
    confirmText: i18n.t("common:actions.delete"),
    tone: "destructive",
  }),
  auditLabel: "qeetai.delete_user",
  async run(ctx, input) {
    await api<void>(`/v1/users/${input.user_id}`, {
      method: "DELETE",
      signal: ctx.signal,
    });
    ctx.queryClient.invalidateQueries({ queryKey: userKeys.tenant(ctx.tenantId) });
    return {
      ok: true,
      summary: `User ${input.user_id} has been deleted.`,
      display: {
        key: "qeetai:toolCallCard.results.userDeleted",
        values: { userId: input.user_id },
      },
      data: { user_id: input.user_id },
    };
  },
};

const resetUserMfaInput = z.object({ user_id: z.string() });
type ResetUserMfaInput = z.infer<typeof resetUserMfaInput>;

export const resetUserMfaTool: ToolDefinition<ResetUserMfaInput> = {
  name: "reset_user_mfa",
  category: "directory",
  title: "qeetai:tools.titles.resetUserMfa",
  description:
    "Remove a user's enrolled MFA factors, forcing re-enrollment at next sign-in. Use when a user has lost their device. Destructive: requires confirmation. (There is no admin endpoint to ENABLE a specific factor for another user — MFA enrollment is a self-scoped ceremony.)",
  input: resetUserMfaInput,
  requiredCapability: "user.write",
  destructive: true,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.users", to: "/users" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.confirm.resetUserMfa.title"),
    body: i18n.t("qeetai:tools.confirm.resetUserMfa.body"),
    affected: [{ label: i18n.t("qeetai:tools.fields.userId"), value: input.user_id }],
    confirmText: i18n.t("qeetai:tools.confirm.resetUserMfa.title"),
    tone: "destructive",
  }),
  auditLabel: "qeetai.reset_user_mfa",
  async run(ctx, input) {
    await api<{ message: string }>(`/v1/users/${input.user_id}/mfa`, {
      method: "DELETE",
      signal: ctx.signal,
    });
    ctx.queryClient.invalidateQueries({ queryKey: userKeys.user(ctx.tenantId, input.user_id) });
    return {
      ok: true,
      summary: `MFA has been reset for user ${input.user_id}. They will be prompted to re-enroll.`,
      display: { key: "qeetai:toolCallCard.results.mfaReset", values: { userId: input.user_id } },
      data: { user_id: input.user_id },
    };
  },
};
