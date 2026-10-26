import { useEffect } from "react";

import { SearchPalette, SearchProvider } from "@/modules/search";
import { useCapabilities } from "@/platform/security/capability-provider";

interface CommandPaletteLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renders the search palette, which ⌘K / Ctrl+K toggles. Must sit inside CapabilityProvider: until
 * capabilities are ready the shortcut is off and the palette closes.
 */
export function CommandPaletteLauncher({ open, onOpenChange }: CommandPaletteLauncherProps) {
  const access = useCapabilities();
  const ready = access.state === "ready";

  useEffect(() => {
    if (!ready && open) onOpenChange(false);
  }, [ready, open, onOpenChange]);

  return (
    <SearchProvider>
      <SearchPalette open={open} onOpenChange={onOpenChange} hotkey={ready} />
    </SearchProvider>
  );
}
