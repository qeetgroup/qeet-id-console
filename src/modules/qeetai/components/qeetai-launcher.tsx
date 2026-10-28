import { useEffect } from "react";

import { workspaceActions } from "../store/workspace-store";

/**
 * Opens and closes the panel on ⌘J / Ctrl+J and renders nothing. Not in useGlobalShortcuts, which
 * ignores modifier keys and typing targets, so the shortcut also works from the composer.
 */
export function QeetAILauncher() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        workspaceActions.toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
