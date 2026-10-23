// Suggestions per route. A tool suggestion names a registered tool and, when picked, sends its
// label as a message; a prompt suggestion sends its text. Every string is a catalogue key, so the
// message is sent in the operator's language, as if they typed it.

import type { Capability } from "@/platform/security/capability-model";

export interface ToolSuggestion {
  type: "tool";
  toolName: string;
  label: string; // Catalogue key
  description?: string; // Catalogue key
  prefillInput?: Record<string, unknown>;
  /** Minimum capability the operator must hold for this suggestion to appear. */
  requiredCapability?: Capability;
}

export interface PromptSuggestion {
  type: "prompt";
  label: string; // Catalogue key
  text: string; // Catalogue key
  description?: string; // Catalogue key
  requiredCapability?: Capability;
}

export type Suggestion = ToolSuggestion | PromptSuggestion;

export interface RouteSuggestionEntry {
  suggestions: Suggestion[]; // Ordered list of suggestions for this route
}

// An exact path, or a prefix ending in `/*`; an exact match wins.
type RoutePattern = string;
type SuggestionMap = Record<RoutePattern, RouteSuggestionEntry>;

export const ROUTE_SUGGESTIONS: SuggestionMap = {
  "/users": {
    suggestions: [
      {
        type: "tool",
        toolName: "search_users",
        label: "qeetai:suggestions.labels.searchUsers",
        description: "qeetai:suggestions.descriptions.searchUsers",
        requiredCapability: "user.read",
      },
      {
        type: "tool",
        toolName: "create_user",
        label: "qeetai:suggestions.labels.createUser",
        requiredCapability: "user.write",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.suspendedUsers",
        text: "qeetai:suggestions.prompts.suspendedUsers",
        requiredCapability: "user.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.userActivity",
        text: "qeetai:suggestions.prompts.userActivity",
        requiredCapability: "audit.read",
      },
    ],
  },

  "/users/$userId": {
    suggestions: [
      {
        type: "tool",
        toolName: "reset_user_mfa",
        label: "qeetai:suggestions.labels.resetMfa",
        description: "qeetai:suggestions.descriptions.resetMfa",
        requiredCapability: "user.write",
      },
      {
        type: "tool",
        toolName: "disable_user",
        label: "qeetai:suggestions.labels.disableUser",
        requiredCapability: "user.write",
      },
      {
        type: "tool",
        toolName: "search_audit_logs",
        label: "qeetai:suggestions.labels.userAuditEvents",
        description: "qeetai:suggestions.descriptions.userAuditEvents",
        requiredCapability: "audit.read",
      },
      {
        type: "tool",
        toolName: "search_sessions",
        label: "qeetai:suggestions.labels.activeSessions",
        requiredCapability: "user.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.userRecentActivity",
        text: "qeetai:suggestions.prompts.userRecentActivity",
        requiredCapability: "audit.read",
      },
    ],
  },

  "/authorization/roles": {
    suggestions: [
      {
        type: "tool",
        toolName: "create_role",
        label: "qeetai:suggestions.labels.createRole",
        requiredCapability: "role.write",
      },
      {
        type: "tool",
        toolName: "grant_permission",
        label: "qeetai:suggestions.labels.grantPermission",
        requiredCapability: "role.write",
      },
      {
        type: "tool",
        toolName: "simulate_authorization",
        label: "qeetai:suggestions.labels.simulateAuthorization",
        description: "qeetai:suggestions.descriptions.simulateAccess",
        requiredCapability: "role.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.explainRoles",
        text: "qeetai:suggestions.prompts.explainRoles",
        requiredCapability: "role.read",
      },
    ],
  },

  "/authorization/policies": {
    suggestions: [
      {
        type: "tool",
        toolName: "simulate_authorization",
        label: "qeetai:suggestions.labels.simulateAuthorization",
        description: "qeetai:suggestions.descriptions.simulateDecision",
        requiredCapability: "policy.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.summarizePolicies",
        text: "qeetai:suggestions.prompts.summarizePolicies",
        requiredCapability: "policy.read",
      },
    ],
  },

  "/authorization/*": {
    suggestions: [
      {
        type: "tool",
        toolName: "simulate_authorization",
        label: "qeetai:suggestions.labels.simulateAuthorization",
        requiredCapability: "role.read",
      },
      {
        type: "tool",
        toolName: "generate_terraform",
        label: "qeetai:suggestions.labels.terraformRoles",
        prefillInput: { resource_type: "role" },
        requiredCapability: "connection.read",
      },
    ],
  },

  "/security/audit-logs": {
    suggestions: [
      {
        type: "tool",
        toolName: "search_audit_logs",
        label: "qeetai:suggestions.labels.searchAuditLogs",
        requiredCapability: "audit.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.summarizeAnomalies",
        text: "qeetai:suggestions.prompts.summarizeAnomalies",
        requiredCapability: "audit.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.failedLogins",
        text: "qeetai:suggestions.prompts.failedLogins",
        requiredCapability: "audit.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.adminActions",
        text: "qeetai:suggestions.prompts.adminActions",
        requiredCapability: "audit.read",
      },
    ],
  },

  "/security/*": {
    suggestions: [
      {
        type: "tool",
        toolName: "search_audit_logs",
        label: "qeetai:suggestions.labels.searchAuditLogs",
        requiredCapability: "audit.read",
      },
      {
        type: "tool",
        toolName: "set_strict_mfa",
        label: "qeetai:suggestions.labels.strictMfaPolicy",
        requiredCapability: "policy.write",
      },
    ],
  },

  "/applications": {
    suggestions: [
      {
        type: "tool",
        toolName: "create_oauth_client",
        label: "qeetai:suggestions.labels.registerOAuthClient",
        requiredCapability: "connection.write",
      },
      {
        type: "tool",
        toolName: "generate_terraform",
        label: "qeetai:suggestions.labels.terraformClients",
        prefillInput: { resource_type: "oidc_client" },
        requiredCapability: "connection.read",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.explainOAuth",
        text: "qeetai:suggestions.prompts.explainOAuth",
      },
    ],
  },

  "/settings/signing-keys": {
    suggestions: [
      {
        type: "tool",
        toolName: "rotate_signing_keys",
        label: "qeetai:suggestions.labels.rotateSigningKeys",
        requiredCapability: "connection.write",
      },
    ],
  },

  "/settings/*": {
    suggestions: [
      {
        type: "tool",
        toolName: "set_strict_mfa",
        label: "qeetai:suggestions.labels.configureStrictMfa",
        requiredCapability: "policy.write",
      },
      {
        type: "prompt",
        label: "qeetai:suggestions.labels.explainSecurity",
        text: "qeetai:suggestions.prompts.explainSecurity",
        requiredCapability: "policy.read",
      },
    ],
  },

  "/organizations": {
    suggestions: [
      {
        type: "tool",
        toolName: "create_organization",
        label: "qeetai:suggestions.labels.createOrganization",
        requiredCapability: "tenant.write",
      },
      {
        type: "tool",
        toolName: "generate_terraform",
        label: "qeetai:suggestions.labels.terraformTenant",
        prefillInput: { resource_type: "tenant" },
        requiredCapability: "connection.read",
      },
    ],
  },

  "/developer/*": {
    suggestions: [
      {
        type: "tool",
        toolName: "generate_sdk_snippet",
        label: "qeetai:suggestions.labels.codeSnippet",
        prefillInput: { language: "typescript", endpoint: "/v1/users" },
      },
      {
        type: "tool",
        toolName: "generate_api_example",
        label: "qeetai:suggestions.labels.apiExample",
        prefillInput: { endpoint: "/v1/users", method: "GET" },
      },
    ],
  },
};
