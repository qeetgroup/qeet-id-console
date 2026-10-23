// Registers every module's manifest with the shell, in the order src/app/modules.ts lists them.
// Imported for its effect by the router (before anything renders) and by the test setup.
import type { ModuleManifest } from "@/platform/modules/manifest";
import { registerModules } from "@/platform/modules/registry";

import { MODULES } from "./modules";

const manifests = import.meta.glob<ModuleManifest>("/src/modules/*/manifest.tsx", {
  eager: true,
  import: "manifest",
});

registerModules(
  MODULES.map((id) => {
    const manifest = manifests[`/src/modules/${id}/manifest.tsx`];
    if (!manifest) throw new Error(`Module "${id}" has no manifest.tsx`);
    if (manifest.id !== id) throw new Error(`Module "${id}" declares the id "${manifest.id}"`);
    return manifest;
  }),
);
