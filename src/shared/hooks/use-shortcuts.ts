import { useEffect } from "react";

// Global keyboard layer: `?` opens the cheat-sheet and a `g`-prefixed sequence jumps between
// sections. Keys are ignored while typing in a field, so they never hijack form input.

/** A section of the shortcuts sheet; `title` and each `description` are catalogue keys. */
export type ShortcutGroup = {
  title: string;
  items: { keys: string[]; description: string; path?: string }[];
};

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "common:shortcuts.group.general",
    items: [
      { keys: ["⌘", "K"], description: "common:shortcuts.action.openCommandPaletteSearch" },
      { keys: ["⌘", "J"], description: "common:shortcuts.action.toggleQeetAi" },
      { keys: ["?"], description: "common:shortcuts.action.showThisShortcutsPanel" },
      { keys: ["Esc"], description: "common:shortcuts.action.closeAnyDrawerOrDialog" },
    ],
  },
  {
    title: "common:shortcuts.group.goTo",
    items: [
      { keys: ["g", "d"], description: "common:shortcuts.action.dashboard", path: "/" },
      { keys: ["g", "u"], description: "common:shortcuts.action.users", path: "/users" },
      {
        keys: ["g", "r"],
        description: "common:shortcuts.action.rolesPermissions",
        path: "/authorization/roles",
      },
      {
        keys: ["g", "i"],
        description: "common:shortcuts.action.invitations",
        path: "/invitations",
      },
      {
        keys: ["g", "t"],
        description: "common:shortcuts.action.organizations",
        path: "/organizations",
      },
      {
        keys: ["g", "w"],
        description: "common:shortcuts.action.webhooks",
        path: "/developer/webhooks",
      },
      {
        keys: ["g", "a"],
        description: "common:shortcuts.action.auditLogs",
        path: "/security/audit-logs",
      },
      {
        keys: ["g", "s"],
        description: "common:shortcuts.action.organizationSettings",
        path: "/settings/organization/general",
      },
    ],
  },
];

const GO_TO: Record<string, string> = {
  d: "/",
  u: "/users",
  r: "/authorization/roles",
  i: "/invitations",
  t: "/organizations",
  w: "/developer/webhooks",
  a: "/security/audit-logs",
  s: "/settings/organization/general",
};

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
        const path = GO_TO[e.key.toLowerCase()];
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
