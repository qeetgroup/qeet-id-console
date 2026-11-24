// Client-side templating that applies nothing. generate_terraform reads live config through the
// owning modules' reads; the SDK snippet and API example are generic templates that make no
// request.

import { z } from "zod";

import { type OidcClient, oidcClientQueries } from "@/modules/authentication";
import { type Role, roleQueries } from "@/modules/authorization";
import { orgQueries } from "@/modules/organizations";
import type { ToolDefinition } from "../types/tool.types";

function hclString(value: string | null | undefined): string {
  if (!value) return '""';
  return JSON.stringify(value);
}

function hclList(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return "[]";
  return `[${items.map((v) => JSON.stringify(v)).join(", ")}]`;
}

const generateTerraformInput = z.object({
  resource_type: z.enum(["oidc_client", "organization", "role"]),
  resource_id: z.string().optional(),
});
type GenerateTerraformInput = z.infer<typeof generateTerraformInput>;

function oidcClientHcl(client: OidcClient): string {
  const label = client.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return [
    `resource "qeetid_oidc_client" ${hclString(label)} {`,
    `  name          = ${hclString(client.name)}`,
    `  type          = ${hclString(client.type)}`,
    `  redirect_uris = ${hclList(client.redirect_uris)}`,
    `  grant_types   = ${hclList(client.grant_types)}`,
    `  scopes        = ${hclList(client.scopes)}`,
    "}",
  ].join("\n");
}

function organizationHcl(org: { name: string; slug: string }): string {
  const label = org.slug || org.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return [
    `resource "qeetid_tenant" ${hclString(label)} {`,
    `  name = ${hclString(org.name)}`,
    `  slug = ${hclString(org.slug)}`,
    "}",
  ].join("\n");
}

function roleHcl(role: Role): string {
  const label = role.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return [
    `resource "qeetid_role" ${hclString(label)} {`,
    `  name        = ${hclString(role.name)}`,
    `  description = ${hclString(role.description)}`,
    "}",
  ].join("\n");
}

export const generateTerraformTool: ToolDefinition<GenerateTerraformInput> = {
  name: "generate_terraform",
  category: "codegen",
  title: "qeetai:tools.titles.generateTerraform",
  description:
    "Generate Terraform (HCL) for an existing resource by reading its live configuration. Client-side templating; nothing is applied.",
  input: generateTerraformInput,
  requiredCapability: "connection.read",
  destructive: false,
  mutates: false,
  auditLabel: "qeetai.generate_terraform",
  async run(ctx, input) {
    let hcl = "";

    // Each read is the owning module's, checked against the contract and shared with its pages.
    if (input.resource_type === "oidc_client") {
      const data = await ctx.queryClient.fetchQuery(oidcClientQueries.list(ctx.organizationId));
      const clients = input.resource_id
        ? data.items.filter((c) => c.id === input.resource_id || c.client_id === input.resource_id)
        : data.items;
      hcl = clients.map(oidcClientHcl).join("\n\n") || "# No applications found.";
    } else if (input.resource_type === "organization") {
      const org = await ctx.queryClient.fetchQuery(
        orgQueries.record(input.resource_id ?? ctx.organizationId),
      );
      hcl = organizationHcl(org);
    } else if (input.resource_type === "role") {
      const data = await ctx.queryClient.fetchQuery(roleQueries.list(ctx.organizationId));
      const roles = input.resource_id
        ? data.items.filter((r) => r.id === input.resource_id)
        : data.items.filter((r) => !r.is_system);
      hcl = roles.map(roleHcl).join("\n\n") || "# No custom roles found.";
    }

    return {
      ok: true,
      summary: `Terraform HCL generated for ${input.resource_type}${input.resource_id ? ` (${input.resource_id})` : "s"}.`,
      display: {
        key: "qeetai:toolCallCard.results.terraformGenerated",
        values: { resource: input.resource_type },
      },
      data: { hcl, resource_type: input.resource_type, resource_id: input.resource_id },
    };
  },
};

const generateSdkSnippetInput = z.object({
  endpoint: z.string(),
  language: z.enum(["curl", "typescript", "go", "python"]),
});
type GenerateSdkSnippetInput = z.infer<typeof generateSdkSnippetInput>;

function curlSnippet(endpoint: string): string {
  return `curl -X GET \\
  "https://api.qeet.id${endpoint}" \\
  -H "Authorization: Bearer $QEET_ACCESS_TOKEN"`;
}

function typescriptSnippet(endpoint: string): string {
  return `import { QeetIdClient } from "@qeet-id/sdk";

const client = new QeetIdClient({
  accessToken: process.env.QEET_ACCESS_TOKEN!,
});

const result = await client.fetch("${endpoint}");
console.log(result);`;
}

function goSnippet(endpoint: string): string {
  return `package main

import (
  "context"
  "fmt"

  qeetid "github.com/qeetgroup/qeet-id-go"
)

func main() {
  client := qeetid.NewClient(qeetid.WithBearerToken(os.Getenv("QEET_ACCESS_TOKEN")))
  ctx := context.Background()
  result, err := client.Get(ctx, "${endpoint}")
  if err != nil {
    panic(err)
  }
  fmt.Printf("%+v\\n", result)
}`;
}

function pythonSnippet(endpoint: string): string {
  return `import os
from qeet_id import QeetIdClient

client = QeetIdClient(
    access_token=os.environ["QEET_ACCESS_TOKEN"],
)

result = client.get("${endpoint}")
print(result)`;
}

export const generateSdkSnippetTool: ToolDefinition<GenerateSdkSnippetInput> = {
  name: "generate_sdk_snippet",
  category: "codegen",
  title: "qeetai:tools.titles.generateSdkSnippet",
  description:
    "Generate a client code snippet (curl/TypeScript/Go/Python) for a known Qeet ID endpoint. Informational; client-side.",
  input: generateSdkSnippetInput,
  destructive: false, // No requiredCapability: it only fills in a template and makes no request
  mutates: false,
  auditLabel: "qeetai.generate_sdk_snippet",
  async run(_ctx, input) {
    let snippet = "";
    switch (input.language) {
      case "curl":
        snippet = curlSnippet(input.endpoint);
        break;
      case "typescript":
        snippet = typescriptSnippet(input.endpoint);
        break;
      case "go":
        snippet = goSnippet(input.endpoint);
        break;
      case "python":
        snippet = pythonSnippet(input.endpoint);
        break;
    }
    return {
      ok: true,
      summary: `Generated ${input.language} snippet for ${input.endpoint}.`,
      display: {
        key: "qeetai:toolCallCard.results.snippetGenerated",
        values: { language: input.language, endpoint: input.endpoint },
      },
      data: { snippet, language: input.language, endpoint: input.endpoint },
    };
  },
};

const generateApiExampleInput = z.object({
  endpoint: z.string(),
  method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
});
type GenerateApiExampleInput = z.infer<typeof generateApiExampleInput>;

function buildApiExample(endpoint: string, method: string): { request: string; response: string } {
  const hasBody = ["POST", "PATCH", "PUT"].includes(method);
  const request = [
    `${method} ${endpoint} HTTP/1.1`,
    "Host: api.qeet.id",
    "Authorization: Bearer <access_token>",
    ...(hasBody ? ["Content-Type: application/json", "", '{ "example": "body" }'] : [""]),
  ].join("\n");

  const isDelete = method === "DELETE";
  const response = isDelete
    ? ["HTTP/1.1 204 No Content", ""].join("\n")
    : [
        "HTTP/1.1 200 OK",
        "Content-Type: application/json",
        "",
        JSON.stringify({ example: "response", endpoint, method }, null, 2),
      ].join("\n");

  return { request, response };
}

export const generateApiExampleTool: ToolDefinition<GenerateApiExampleInput> = {
  name: "generate_api_example",
  category: "codegen",
  title: "qeetai:tools.titles.generateApiExample",
  description:
    "Generate an example request/response for a Qeet ID endpoint derived from its OpenAPI shape. Informational; client-side.",
  input: generateApiExampleInput,
  destructive: false, // No requiredCapability: it only fills in a template and makes no request
  mutates: false,
  auditLabel: "qeetai.generate_api_example",
  async run(_ctx, input) {
    const example = buildApiExample(input.endpoint, input.method);
    return {
      ok: true,
      summary: `Generated ${input.method} ${input.endpoint} example.`,
      display: {
        key: "qeetai:toolCallCard.results.exampleGenerated",
        values: { method: input.method, endpoint: input.endpoint },
      },
      data: {
        request: example.request,
        response: example.response,
        endpoint: input.endpoint,
        method: input.method,
      },
    };
  },
};
