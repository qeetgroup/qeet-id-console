// Tool registry: assembles a Map<name, ToolDefinition> from all definitions
// and exposes the three primary access points consumed by the execution engine
// and the UI.
//
// getTool(name)    — look up a single definition by its manifest name.
// listTools()      — all 21 definitions in insertion order.
// enabledTools(can) — subset visible to the current operator (change-tool switch
//                     + capability gate).
//
// The registry name-set is parity-checked against api/qeetai/tools.manifest.json
// by the qa parity test (vitest). Every name here MUST equal a manifest entry and
// vice-versa.

import type { Capability } from "@/platform/security/capability-model";
import type { ToolDefinition } from "./types/tool.types";

// ── Import all definitions ────────────────────────────────────────────────────

import { searchAuditLogsTool, searchSessionsTool } from "./definitions/audit.tools";
import { setStrictMfaTool, simulateAuthorizationTool } from "./definitions/authz.tools";
import {
  generateApiExampleTool,
  generateSdkSnippetTool,
  generateTerraformTool,
} from "./definitions/codegen.tools";
import {
  createOAuthClientTool,
  rotateOAuthClientSecretTool,
  rotateSigningKeysTool,
} from "./definitions/credentials.tools";
import { createOrganizationTool } from "./definitions/org.tools";
import { assignRoleTool, createRoleTool, grantPermissionTool } from "./definitions/role.tools";
import {
  createUserTool,
  deleteUserTool,
  disableUserTool,
  enableUserTool,
  resetUserMfaTool,
  searchUsersTool,
  updateUserTool,
} from "./definitions/user.tools";

// ── Assemble registry ─────────────────────────────────────────────────────────

// Order matches §B of the spec (directory → credentials → audit → authz → codegen).
// ToolDefinition<any>: the registry is a heterogeneous map; the execution engine
// re-validates each input via the tool's own Zod schema before dispatch, so
// `any` here is safe and avoids the contravariant `confirm` function mismatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TOOLS: ToolDefinition<any>[] = [
  // Directory — user
  searchUsersTool,
  createUserTool,
  updateUserTool,
  disableUserTool,
  enableUserTool,
  deleteUserTool,
  resetUserMfaTool,
  // Directory — org
  createOrganizationTool,
  // Directory — role
  createRoleTool,
  assignRoleTool,
  grantPermissionTool,
  // Authz (non-directory)
  setStrictMfaTool,
  // Credentials
  createOAuthClientTool,
  rotateOAuthClientSecretTool,
  rotateSigningKeysTool,
  // Audit
  searchAuditLogsTool,
  searchSessionsTool,
  // Authz — simulation
  simulateAuthorizationTool,
  // Codegen
  generateTerraformTool,
  generateSdkSnippetTool,
  generateApiExampleTool,
];

const REGISTRY = new Map<string, ToolDefinition>(ALL_TOOLS.map((t) => [t.name, t]));

// ── Public API ────────────────────────────────────────────────────────────────

/** Look up a tool definition by its exact manifest name. */
export function getTool(name: string): ToolDefinition | undefined {
  return REGISTRY.get(name);
}

/** All 21 tool definitions in canonical order. */
export function listTools(): ToolDefinition[] {
  return ALL_TOOLS;
}

/**
 * Owner decision for 1.0: the assistant only reads and explains. While this is
 * false, no tool that changes anything is run, and route suggestions don't offer
 * one. The change tools stay in place for when the server bounds the
 * assistant's own authority.
 */
export const ASSISTANT_CHANGE_TOOLS_ENABLED = false;

/** Error code a withheld change tool settles with. */
export const CHANGE_TOOLS_DISABLED = "change_tools_disabled";

/** True when `tool` changes something and change tools are switched off. */
export function isWithheldChange(
  tool: ToolDefinition,
  changeToolsEnabled = ASSISTANT_CHANGE_TOOLS_ENABLED,
): boolean {
  return tool.mutates && !changeToolsEnabled;
}

/**
 * The tool result for a withheld change tool. It goes back to the model, which
 * explains the steps instead, and names the screen where the operator can make
 * the change themselves.
 */
export function changeRefusal(tool: ToolDefinition): { code: string; message: string } {
  const screen = tool.consoleScreen;
  const where = screen
    ? ` ${screen.hint ?? "The operator can make this change themselves"} on the ${screen.label} screen (${screen.to}).`
    : "";
  return {
    code: CHANGE_TOOLS_DISABLED,
    message: `The assistant can't make changes in this version, so nothing was changed.${where}`,
  };
}

/**
 * Subset of tools the current operator can see: filters out change tools while
 * they are switched off, and any tool whose `requiredCapability` the `can`
 * predicate returns false for.
 *
 * This is a UX gate (defense-in-depth); the backend endpoints each tool calls
 * remain the real authorization boundary. Never use this as a security check.
 */
export function enabledTools(
  can: (c?: Capability) => boolean,
  changeToolsEnabled = ASSISTANT_CHANGE_TOOLS_ENABLED,
): ToolDefinition[] {
  return ALL_TOOLS.filter(
    (t) => !isWithheldChange(t, changeToolsEnabled) && can(t.requiredCapability),
  );
}
