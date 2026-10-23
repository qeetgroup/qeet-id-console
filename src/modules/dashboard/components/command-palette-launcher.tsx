import { useEffect } from "react";

import { useCapabilities } from "@/platform/security/capability-provider";
import { SearchProvider, UniversalSearch } from "@/modules/search";

interface CommandPaletteLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renders the universal search palette and toggles it on ⌘K / Ctrl-K. Must sit inside
 * CapabilityProvider: until capabilities are ready the shortcut is off and the palette closes.
 */
export function CommandPaletteLauncher({ open, onOpenChange }: CommandPaletteLauncherProps) {
  const access = useCapabilities();

  useEffect(() => {
    if (access.state !== "ready") {
      if (open) onOpenChange(false);
      return;
    }
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [access.state, open, onOpenChange]);

  return (
    <SearchProvider>
      <UniversalSearch open={open} onOpenChange={onOpenChange} />
    </SearchProvider>
  );
}
