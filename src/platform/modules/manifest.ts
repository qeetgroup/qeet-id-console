// What a module contributes to the console shell. Each module exports one `manifest` from its
// `manifest.ts(x)`; src/app registers them all at startup, and the shell reads the registry, so a
// new module adds its sidebar items, commands and shortcuts without editing a shared file.
// Copy is always a catalogue key, preferably in the module's own namespace.

import type { ReactNode } from "react";

import type { TranslationKey } from "@/i18n";
import type { Capability } from "@/platform/security/capability-model";

/** An entry a module adds to a sidebar group, or under another entry with `parent`. */
export interface NavContribution {
  id: string; // unique across the console, e.g. "directory.users"
  group: string; // the sidebar group it belongs to, e.g. "directory"
  parent?: string; // the id of the entry it nests under
  order: number; // its place among its siblings, lowest first
  title: TranslationKey;
  description?: TranslationKey; // shown on section overview cards
  url: string;
  icon?: ReactNode;
  capability?: Capability; // hides the entry, and guards its routes, without it
  planned?: boolean; // listed, but left out of search until it has a screen
}

// The catalogue sections that hold a given leaf key, e.g. "users:commands.createUser".
type SectionsWith<Leaf extends string> = TranslationKey extends infer Key
  ? Key extends `${infer Section}.${Leaf}`
    ? Section
    : never
  : never;

/** A catalogue section holding a command's `title`, `subtitle` and comma-separated `keywords`. */
export type CommandCopy = Extract<
  SectionsWith<"keywords">,
  Extract<SectionsWith<"title">, SectionsWith<"subtitle">>
>;

/** A command palette entry. Commands only navigate; the screen runs the action itself. */
export interface CommandContribution {
  id: string; // e.g. "cmd.create.user"
  text: CommandCopy;
  icon: ReactNode;
  to: string;
  capability?: Capability;
}

/** A `g` then `key` keyboard shortcut that goes to a page. */
export interface ShortcutContribution {
  key: string; // a single lower-case letter
  description: TranslationKey;
  to: string;
}

/**
 * A feature flag, with an owner to ask. A rollout flag has an `expires` date by which it is
 * removed and the winning path kept (a test fails once it has passed); a lasting kill switch has
 * none and says why. `enabled` is the build's default; a deployment can turn any flag off at
 * runtime with CONSOLE_FLAGS_OFF.
 */
export interface FeatureFlagDefinition {
  id: string;
  owner: string; // the team or person who decides it
  expires: string | null; // ISO date; null for a lasting kill switch
  description: string; // why it exists, for whoever removes or flips it
  enabled: boolean;
}

/**
 * Extension points modules offer one another. A module that reads one declares it by augmenting
 * this interface, so its contributors are type-checked:
 * `declare module "@/platform/modules/manifest" { interface ModuleExtensions { … } }`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by the modules that read an extension
export interface ModuleExtensions {}

export interface ModuleManifest {
  id: string; // the module's folder name
  nav?: readonly NavContribution[];
  commands?: readonly CommandContribution[];
  shortcuts?: readonly ShortcutContribution[];
  flags?: readonly FeatureFlagDefinition[];
  extensions?: ModuleExtensions;
}

/** Returns `manifest` unchanged; it exists to type-check a module's manifest where it's written. */
export function defineModule(manifest: ModuleManifest): ModuleManifest {
  return manifest;
}
