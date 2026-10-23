import type { CommandPaletteItem } from "@qeetrix/ui";
import { useEffect } from "react";

import type { NavGroup } from "@/platform/config/navigation";
import type { Capability } from "@/platform/security/capability-model";
import { useCapabilities } from "@/platform/security/capability-provider";
import { SearchProvider, UniversalSearch } from "@/modules/search";

/**
 * Flattens the sidebar nav tree into command-palette items; `can` filters only parents that have
 * children. The universal search builds its own list with `buildNavSearchItems`.
 */
export function buildCommandPaletteItems(
  groups: NavGroup[],
  can: (permission?: Capability) => boolean = () => true,
): CommandPaletteItem[] {
  const out: CommandPaletteItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.items && item.items.length > 0) {
        const isPureGroup = item.items.some((s) => s.url === item.url);
        if (!isPureGroup && can(item.requiredPermission)) {
          out.push({
            id: item.url,
            title: item.title,
            group: group.label,
            icon: item.icon ? <span className="[&_svg]:size-4 flex">{item.icon}</span> : undefined,
            keywords: [item.title.toLowerCase()],
          });
        }
        for (const sub of item.items) {
          out.push({
            id: sub.url,
            title: sub.title,
            group: group.label,
            keywords: [item.title.toLowerCase(), sub.title.toLowerCase()],
          });
        }
      } else {
        out.push({
          id: item.url,
          title: item.title,
          group: group.label,
          icon: item.icon ? <span className="[&_svg]:size-4 flex">{item.icon}</span> : undefined,
          keywords: [item.title.toLowerCase()],
        });
      }
    }
  }
  return out;
}

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
