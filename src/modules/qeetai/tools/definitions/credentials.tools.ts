import { z } from "zod";
import { createOidcClient, authKeys, rotateOidcClientSecret } from "@/modules/authentication";

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
  title: "Create OAuth client",
  description:
    "Register a new OAuth/OIDC client application. Confidential clients return a client_secret exactly once — it is shown to the operator only and is never sent to the model.",
  input: createOAuthClientInput,
  requiredCapability: "connection.write",
  destructive: false,
  mutates: true,
  consoleScreen: { label: "Applications", to: "/auth/connections/oidc" },
  confirm: (input) => ({
    title: "Create OAuth client",
    body: "This registers a new OAuth/OIDC client. Confidential clients mint a client secret shown once.",
    affected: [{ label: "Client name", value: input.name }],
    confirmText: "Create client",
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
              label: `Client secret for "${res.client.name}"`,
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
  title: "Rotate OAuth client secret",
  description:
    "Rotate a confidential OAuth client's secret. The old secret stops working. The new secret is shown to the operator once and never sent to the model. Destructive: requires confirmation.",
  input: rotateOAuthClientSecretInput,
  requiredCapability: "connection.write",
  destructive: true,
  mutates: true,
  consoleScreen: { label: "Applications", to: "/auth/connections/oidc" },
  confirm: (input) => ({
    title: "Rotate client secret",
    body: "The existing client secret will stop working immediately. Update your application before confirming. The new secret is shown once only.",
    affected: [{ label: "Client ID", value: input.client_id }],
    confirmText: "Rotate",
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
      data: { client_id: input.client_id },
      sensitiveArtifact: res.client_secret
        ? {
            kind: "secret" as const,
            label: `New client secret for ${input.client_id}`,
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
  title: "Rotate signing keys",
  description:
    "Signing keys rotate by deployment, not from the console, so this explains where rotation happens and changes nothing.",
  input: rotateSigningKeysInput,
  requiredCapability: "connection.write",
  destructive: true,
  mutates: true,
  consoleScreen: {
    label: "Signing keys",
    to: "/auth/api/signing-keys",
    hint: "Signing keys rotate by deployment; the current keys are listed",
  },
  confirm: () => ({
    title: "Rotate signing keys",
    body: "Signing keys rotate by deployment, not from the console. Nothing will be changed.",
    affected: [{ label: "Action", value: "None" }],
    confirmText: "OK",
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
