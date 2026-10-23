import type { Capability } from "@/platform/security/capability-model";
import type { ToolDefinition } from "./types/tool.types";

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

// Each entry is a ToolDefinition<I> for its own input type, so the cast erases I. It is sound:
// the engine only calls `confirm`/`run` with `tool.input.safeParse(raw).data`, a value of that I.
const ALL_TOOLS = [
  searchUsersTool,
  createUserTool,
  updateUserTool,
  disableUserTool,
  enableUserTool,
  deleteUserTool,
  resetUserMfaTool,
  createOrganizationTool,
  createRoleTool,
  assignRoleTool,
  grantPermissionTool,
  setStrictMfaTool,
  createOAuthClientTool,
  rotateOAuthClientSecretTool,
  rotateSigningKeysTool,
  searchAuditLogsTool,
  searchSessionsTool,
  simulateAuthorizationTool,
  generateTerraformTool,
  generateSdkSnippetTool,
  generateApiExampleTool,
] as ToolDefinition[];

const REGISTRY = new Map<string, ToolDefinition>(ALL_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return REGISTRY.get(name);
}

export function listTools(): ToolDefinition[] {
  return ALL_TOOLS;
}

/**
 * Off: the assistant only reads and explains, so no change tool runs and no suggestion offers
 * one. The change tools stay for when the server bounds the assistant's own authority.
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
 * Returns the error a withheld change tool settles with. It goes to the model, which explains
 * the steps instead, and names the screen where the operator can make the change.
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
 * Returns the tools to offer: no withheld change tool, and none whose `requiredCapability` `can`
 * rejects. A UX gate only, never a security check: the backend each tool calls decides.
 */
export function enabledTools(
  can: (c?: Capability) => boolean,
  changeToolsEnabled = ASSISTANT_CHANGE_TOOLS_ENABLED,
): ToolDefinition[] {
  return ALL_TOOLS.filter(
    (t) => !isWithheldChange(t, changeToolsEnabled) && can(t.requiredCapability),
  );
}
