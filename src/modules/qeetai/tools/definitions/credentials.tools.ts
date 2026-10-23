import { z } from "zod";
import { createOidcClient, authKeys, rotateOidcClientSecret } from "@/modules/authentication";

import i18n from "@/i18n";
import type { ToolDefinition } from "../types/tool.types";

const createOAuthClientInput = z.object({
  name: z.string(),
  type: z.enum(["public", "confidential"]),
  redirect_uris: z.array(z.string()).optional(),
  grant_types: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
});
type CreateOAuthClientInput = z.infer<typeof createOAuthClientInput>;

export const createOAuthClientTool: ToolDefinition<CreateOAuthClientInput> = {
  name: "create_oauth_client",
  category: "credentials",
  title: "qeetai:tools.titles.createOAuthClient",
  description:
    "Register a new OAuth/OIDC client application. Confidential clients return a client_secret exactly once — it is shown to the operator only and is never sent to the model.",
  input: createOAuthClientInput,
  requiredCapability: "connection.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.applications", to: "/auth/connections/oidc" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.titles.createOAuthClient"),
    body: i18n.t("qeetai:tools.confirm.createOAuthClient.body"),
    affected: [{ label: i18n.t("qeetai:tools.fields.clientName"), value: input.name }],
    confirmText: i18n.t("qeetai:tools.confirm.createOAuthClient.action"),
    tone: "default",
  }),
  auditLabel: "qeetai.create_oauth_client",
  async run(ctx, input) {
    const res = await createOidcClient(ctx.tenantId, input, ctx.signal);
    ctx.queryClient.invalidateQueries({ queryKey: authKeys.oidcClients(ctx.tenantId) });

    // The secret goes only to sensitiveArtifact, so it never reaches the model.
    return {
      ok: true,
      summary: `OAuth client "${res.client.name}" registered (client_id: ${res.client.client_id}, type: ${res.client.type}).${input.type === "confidential" ? " The client secret has been shown to the operator separately and cannot be retrieved again." : ""}`,
      display: {
        key:
          input.type === "confidential"
            ? "qeetai:toolCallCard.results.clientRegisteredWithSecret"
            : "qeetai:toolCallCard.results.clientRegistered",
        values: { name: res.client.name },
      },
      data: {
        id: res.client.id,
        client_id: res.client.client_id,
        name: res.client.name,
        type: res.client.type,
      },
      sensitiveArtifact:
        input.type === "confidential" && res.client_secret
          ? {
              kind: "secret" as const,
              label: i18n.t("qeetai:tools.secrets.clientSecret", { name: res.client.name }),
              value: res.client_secret,
            }
          : undefined,
    };
  },
};

const rotateOAuthClientSecretInput = z.object({ client_id: z.string() });
type RotateOAuthClientSecretInput = z.infer<typeof rotateOAuthClientSecretInput>;

export const rotateOAuthClientSecretTool: ToolDefinition<RotateOAuthClientSecretInput> = {
  name: "rotate_oauth_client_secret",
  category: "credentials",
  title: "qeetai:tools.titles.rotateOAuthClientSecret",
  description:
    "Rotate a confidential OAuth client's secret. The old secret stops working. The new secret is shown to the operator once and never sent to the model. Destructive: requires confirmation.",
  input: rotateOAuthClientSecretInput,
  requiredCapability: "connection.write",
  destructive: true,
  mutates: true,
  consoleScreen: { label: "qeetai:tools.screens.applications", to: "/auth/connections/oidc" },
  confirm: (input) => ({
    title: i18n.t("qeetai:tools.confirm.rotateOAuthClientSecret.title"),
    body: i18n.t("qeetai:tools.confirm.rotateOAuthClientSecret.body"),
    affected: [{ label: i18n.t("qeetai:tools.fields.clientId"), value: input.client_id }],
    confirmText: i18n.t("qeetai:tools.confirm.rotateOAuthClientSecret.action"),
    tone: "destructive",
  }),
  auditLabel: "qeetai.rotate_oauth_client_secret",
  async run(ctx, input) {
    const res = await rotateOidcClientSecret(ctx.tenantId, input.client_id, ctx.signal);
    ctx.queryClient.invalidateQueries({ queryKey: authKeys.oidcClients(ctx.tenantId) });

    // The new secret goes only to sensitiveArtifact, so it never reaches the model.
    return {
      ok: true,
      summary: `Client secret rotated for client ${input.client_id}. The new secret has been shown to the operator separately and cannot be retrieved again.`,
      display: {
        key: "qeetai:toolCallCard.results.secretRotated",
        values: { clientId: input.client_id },
      },
      data: { client_id: input.client_id },
      sensitiveArtifact: res.client_secret
        ? {
            kind: "secret" as const,
            label: i18n.t("qeetai:tools.secrets.newClientSecret", { clientId: input.client_id }),
            value: res.client_secret,
          }
        : undefined,
    };
  },
};

const rotateSigningKeysInput = z.object({});
type RotateSigningKeysInput = z.infer<typeof rotateSigningKeysInput>;

export const rotateSigningKeysTool: ToolDefinition<RotateSigningKeysInput> = {
  name: "rotate_signing_keys",
  category: "credentials",
  title: "qeetai:tools.titles.rotateSigningKeys",
  description:
    "Signing keys rotate by deployment, not from the console, so this explains where rotation happens and changes nothing.",
  input: rotateSigningKeysInput,
  requiredCapability: "connection.write",
  destructive: true,
  mutates: true,
  consoleScreen: {
    label: "qeetai:tools.screens.signingKeys",
    to: "/auth/api/signing-keys",
    hint: "Signing keys rotate by deployment; the current keys are listed",
  },
  confirm: () => ({
    title: i18n.t("qeetai:tools.titles.rotateSigningKeys"),
    body: i18n.t("qeetai:tools.confirm.rotateSigningKeys.body"),
    affected: [
      { label: i18n.t("qeetai:tools.fields.action"), value: i18n.t("qeetai:tools.values.none") },
    ],
    confirmText: i18n.t("qeetai:tools.confirm.rotateSigningKeys.action"),
    tone: "default",
  }),
  auditLabel: "qeetai.rotate_signing_keys",
  // Keys rotate by deployment only; the tool exists so a request to rotate gets that answer
  // rather than "unknown tool".
  async run() {
    const message = "Signing keys rotate by deployment, not from the console. Nothing was changed.";
    return { ok: false, summary: message, error: { code: "rotation_by_deployment", message } };
  },
};
