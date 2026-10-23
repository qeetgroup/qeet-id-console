// The registered module manifests. src/app fills it once, before anything renders; the shell
// reads it. Platform code can't import modules, so this is how their contributions reach it.

import type {
  CommandContribution,
  FeatureFlagDefinition,
  ModuleExtensions,
  ModuleManifest,
  NavContribution,
  ShortcutContribution,
} from "./manifest";

let manifests: readonly ModuleManifest[] = [];

/** Registers every module's manifest, replacing any registered before. Throws on a duplicate id. */
export function registerModules(next: readonly ModuleManifest[]): void {
  const seen = new Set<string>();
  for (const m of next) {
    if (seen.has(m.id)) throw new Error(`Module "${m.id}" is registered twice`);
    seen.add(m.id);
  }
  manifests = next;
}

/** Returns the registered manifests, in registration order. */
export function registeredModules(): readonly ModuleManifest[] {
  return manifests;
}

export function navContributions(): NavContribution[] {
  return manifests.flatMap((m) => m.nav ?? []);
}

export function commandContributions(): CommandContribution[] {
  return manifests.flatMap((m) => m.commands ?? []);
}

export function shortcutContributions(): ShortcutContribution[] {
  return manifests.flatMap((m) => m.shortcuts ?? []);
}

export function flagDefinitions(): FeatureFlagDefinition[] {
  return manifests.flatMap((m) => m.flags ?? []);
}

/** Returns every module's contribution to one extension point. */
export function extensionContributions<K extends keyof ModuleExtensions>(
  point: K,
): NonNullable<ModuleExtensions[K]>[] {
  return manifests.flatMap((m) => {
    const value = m.extensions?.[point];
    return value === undefined ? [] : [value as NonNullable<ModuleExtensions[K]>];
  });
}
