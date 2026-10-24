import { useEffect } from "react";

import type { TranslationKey } from "@/i18n";
import { shortcutContributions } from "@/platform/modules/registry";

// Global keyboard layer: `?` opens the cheat-sheet and a `g`-prefixed sequence jumps between
// sections, as the modules' manifests declare. Keys are ignored while typing in a field, so they
// never hijack form input.

/** A section of the shortcuts sheet; `title` and each `description` are catalogue keys. */
export type ShortcutGroup = {
  title: TranslationKey;
  items: { keys: string[]; description: TranslationKey; path?: string }[];
};

const GENERAL: ShortcutGroup = {
  title: "common:shortcuts.group.general",
  items: [
    { keys: ["⌘", "K"], description: "common:shortcuts.action.openCommandPaletteSearch" },
    { keys: ["⌘", "J"], description: "common:shortcuts.action.toggleQeetAi" },
    { keys: ["?"], description: "common:shortcuts.action.showThisShortcutsPanel" },
    { keys: ["Esc"], description: "common:shortcuts.action.closeAnyDrawerOrDialog" },
  ],
};

/** Returns the shortcuts sheet: the shell's own, then the `g` shortcuts the modules declare. */
export function shortcutGroups(): ShortcutGroup[] {
  const goTo = shortcutContributions().map((s) => ({
    keys: ["g", s.key],
    description: s.description,
    path: s.to,
  }));
  return goTo.length > 0
    ? [GENERAL, { title: "common:shortcuts.group.goTo", items: goTo }]
    : [GENERAL];
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

type Options = {
  onHelp: () => void;
  navigate: (path: string) => void;
  canNavigate?: (path: string) => boolean;
};

export function useGlobalShortcuts({ onHelp, navigate, canNavigate = () => true }: Options) {
  useEffect(() => {
    let awaitingGo = false;
    let goTimer: ReturnType<typeof setTimeout> | undefined;

    function clearGo() {
      awaitingGo = false;
      if (goTimer) clearTimeout(goTimer);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (awaitingGo) {
        const key = e.key.toLowerCase();
        const path = shortcutContributions().find((s) => s.key === key)?.to;
        clearGo();
        if (path && canNavigate(path)) {
          e.preventDefault();
          navigate(path);
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        onHelp();
        return;
      }

      if (e.key.toLowerCase() === "g") {
        awaitingGo = true;
        goTimer = setTimeout(clearGo, 1500);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearGo();
    };
  }, [canNavigate, onHelp, navigate]);
}
