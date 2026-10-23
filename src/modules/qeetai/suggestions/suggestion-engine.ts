import type { Capability } from "@/platform/security/capability-model";
import type { ConsoleContext } from "../context/types/context.types";
import { getTool, isWithheldChange } from "../tools";
import { ROUTE_SUGGESTIONS, type Suggestion } from "./route-suggestions";

/** Returns the exact match's suggestions, else the longest matching `/*` prefix's, else none. */
function matchSuggestions(pathname: string): Suggestion[] {
  // No entry is undefined, so `undefined` means there is no exact match.
  const exact = ROUTE_SUGGESTIONS[pathname];
  if (exact !== undefined) {
    return exact.suggestions;
  }

  let bestLen = -1;
  let bestSuggestions: Suggestion[] = [];

  for (const [pattern, entry] of Object.entries(ROUTE_SUGGESTIONS)) {
    if (!pattern.endsWith("/*")) continue;
    const prefix = pattern.slice(0, -2); // strip /*
    if (pathname.startsWith(prefix)) {
      if (prefix.length > bestLen) {
        bestLen = prefix.length;
        bestSuggestions = entry.suggestions;
      }
    }
  }

  return bestSuggestions;
}

/** True for a tool suggestion that acts on the selected kind, e.g. `disable_user` for a user. */
function matchesSelection(suggestion: Suggestion, selection: ConsoleContext["selection"]): boolean {
  if (!selection || suggestion.type !== "tool") return false;

  const { kind } = selection;
  const { toolName } = suggestion;

  if (kind === "user") {
    return [
      "disable_user",
      "enable_user",
      "delete_user",
      "reset_user_mfa",
      "update_user",
      "assign_role",
    ].includes(toolName);
  }
  if (kind === "role") {
    return ["grant_permission", "assign_role"].includes(toolName);
  }
  if (kind === "oidc_client") {
    return ["rotate_oauth_client_secret"].includes(toolName);
  }
  return false;
}

/**
 * Returns up to 8 suggestions for the current route in declared order, minus those the operator
 * lacks the capability for and withheld change tools. Tool suggestions that act on the page's
 * selection come first, prefilled with its id.
 */
export function rankSuggestions(
  ctx: ConsoleContext,
  can: (c?: Capability) => boolean,
): Suggestion[] {
  const raw = matchSuggestions(ctx.route.pathname);

  const visible = raw.filter((s) => {
    if (s.type === "tool") {
      const tool = getTool(s.toolName);
      if (tool && isWithheldChange(tool)) return false;
    }
    if (!s.requiredCapability) return true;
    return can(s.requiredCapability);
  });

  const boosted: Suggestion[] = [];
  const rest: Suggestion[] = [];

  for (const s of visible) {
    if (matchesSelection(s, ctx.selection)) {
      if (s.type === "tool" && ctx.selection) {
        const { id } = ctx.selection;
        const selectionPrefill: Record<string, unknown> = { ...s.prefillInput };
        if (ctx.selection.kind === "user") selectionPrefill.user_id = id;
        if (ctx.selection.kind === "role") selectionPrefill.role_id = id;
        if (ctx.selection.kind === "oidc_client") selectionPrefill.client_id = id;
        boosted.push({ ...s, prefillInput: selectionPrefill });
      } else {
        boosted.push(s);
      }
    } else {
      rest.push(s);
    }
  }

  // Capped to keep the suggestion strip compact.
  return [...boosted, ...rest].slice(0, 8);
}
