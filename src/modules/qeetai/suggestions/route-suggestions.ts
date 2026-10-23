// The suggestion types, and the extension point through which modules add suggestions to their
// routes (see their manifests). A tool suggestion names a registered tool and, when picked, sends
// its label as a message; a prompt suggestion sends its text. Every string is a catalogue key, so
// the message is sent in the operator's language, as if they typed it.

import type { TranslationKey } from "@/i18n";
import type { Capability } from "@/platform/security/capability-model";

export interface ToolSuggestion {
  type: "tool";
  toolName: string;
  label: TranslationKey;
  description?: TranslationKey;
  prefillInput?: Record<string, unknown>;
  /** Minimum capability the operator must hold for this suggestion to appear. */
  requiredCapability?: Capability;
}

export interface PromptSuggestion {
  type: "prompt";
  label: TranslationKey;
  text: TranslationKey;
  description?: TranslationKey;
  requiredCapability?: Capability;
}

export type Suggestion = ToolSuggestion | PromptSuggestion;

declare module "@/platform/modules/manifest" {
  interface ModuleExtensions {
    /**
     * Qeet AI's suggestions per route, keyed by an exact path (a `$param` segment matches any one
     * segment) or a prefix ending in `/*`. An exact match wins, then the longest prefix.
     */
    qeetaiSuggestions?: Record<string, readonly Suggestion[]>;
  }
}
