import {
  ClockAlt,
  CloseCircle,
  EditAlt,
  MagicStar,
  Maximize,
  MaximizeAlt,
  Screenmirroring,
  SidebarLeft,
  SidebarRight,
} from "@qeetrix/icons";
import { Button, cn } from "@qeetrix/ui";
import { useStore } from "@tanstack/react-store";

import { conversationActions } from "../store/conversation-store";
import { workspaceActions, workspaceStore } from "../store/workspace-store";
import type { QeetAIMode } from "../types/qeetai.types";

const MODES: { mode: QeetAIMode; label: string; icon: typeof SidebarLeft }[] = [
  { mode: "docked", label: "Dock to side", icon: SidebarLeft },
  { mode: "floating", label: "Float", icon: Screenmirroring },
  { mode: "fullscreen", label: "Full screen", icon: Maximize },
];

/** The workspace title bar: identity, new-chat, mode switch, collapse, close. */
export function QeetAIHeader({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  const mode = useStore(workspaceStore, (s) => s.mode);
  const historyOpen = useStore(workspaceStore, (s) => s.historyOpen);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-card/60 px-2 ps-3">
      {/* Only the title is the drag handle — spreading the pointer handlers over
          the whole header would let useFloatingWindow start a drag on button
          pointer-down and swallow the click (breaking close / mode / history). */}
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2",
          dragHandleProps && "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        {...dragHandleProps}
      >
        <MagicStar className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate font-heading text-sm font-semibold">Ask Qeet</span>
      </span>

      <Button
        variant={historyOpen ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label="Conversation history"
        aria-pressed={historyOpen}
        title="History"
        className={historyOpen ? "text-primary" : undefined}
        onClick={() => workspaceActions.toggleHistory()}
      >
        <ClockAlt className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New conversation"
        title="New conversation"
        onClick={() => {
          conversationActions.create();
          workspaceActions.closeHistory();
        }}
      >
        <EditAlt className="size-4" />
      </Button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <div className="flex items-center gap-0.5">
        {MODES.map(({ mode: m, label, icon: Icon }) => {
          const active = mode === m;
          const Glyph = m === "fullscreen" && active ? MaximizeAlt : Icon;
          return (
            <Button
              key={m}
              variant={active ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={label}
              aria-pressed={active}
              title={label}
              className={cn(active && "text-primary")}
              onClick={() =>
                m === "fullscreen" && active
                  ? workspaceActions.setMode("docked")
                  : workspaceActions.setMode(m)
              }
            >
              <Glyph className="size-4" />
            </Button>
          );
        })}
      </div>

      {mode === "docked" ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Collapse panel"
          title="Collapse"
          onClick={() => workspaceActions.toggleCollapsed()}
        >
          <SidebarRight className="size-4" />
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close Qeet AI"
        title="Close (⌘J)"
        onClick={() => workspaceActions.close()}
      >
        <CloseCircle className="size-4" />
      </Button>
    </header>
  );
}
