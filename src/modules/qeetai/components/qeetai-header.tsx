import { Button, cn } from "@qeetrix/ui";
import { useStore } from "@tanstack/react-store";
import {
  type IconProps,
  Maximize2Icon,
  Minimize2Icon,
  PanelLeftIcon,
  PanelRightCloseIcon,
  PictureInPicture2Icon,
  RotateCcwClockIcon,
  SparklesIcon,
  SquarePenIcon,
  XIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { conversationActions } from "../store/conversation-store";
import { workspaceActions, workspaceStore } from "../store/workspace-store";
import type { QeetAIMode } from "../types/qeetai.types";

// Each mode's label is `qeetaiHeader.modes.<mode>`.
const MODES: { mode: QeetAIMode; icon: ComponentType<IconProps<"outline">> }[] = [
  { mode: "docked", icon: PanelLeftIcon },
  { mode: "floating", icon: PictureInPicture2Icon },
  { mode: "fullscreen", icon: Maximize2Icon },
];

/** Renders the workspace title bar: title, new chat, history, mode switch, collapse, close. */
export function QeetAIHeader({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation("qeetai");
  const mode = useStore(workspaceStore, (s) => s.mode);
  const historyOpen = useStore(workspaceStore, (s) => s.historyOpen);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-card/60 px-2 ps-3">
      {/* Only the title drags: on the whole header, a drag would start on a button's
          pointer-down and swallow its click. */}
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2",
          dragHandleProps && "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        {...dragHandleProps}
      >
        <SparklesIcon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate font-heading text-sm font-semibold">
          {t("qeetaiHeader.askQeet")}
        </span>
      </span>

      <Button
        variant={historyOpen ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={t("qeetaiHeader.conversationHistory")}
        aria-pressed={historyOpen}
        title={t("qeetaiHeader.history")}
        className={historyOpen ? "text-primary" : undefined}
        onClick={() => workspaceActions.toggleHistory()}
      >
        <RotateCcwClockIcon className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("qeetaiHeader.newConversation")}
        title={t("qeetaiHeader.newConversation")}
        onClick={() => {
          conversationActions.create();
          workspaceActions.closeHistory();
        }}
      >
        <SquarePenIcon className="size-4" />
      </Button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <div className="flex items-center gap-0.5">
        {MODES.map(({ mode: m, icon: Icon }) => {
          const active = mode === m;
          const label = t(`qeetaiHeader.modes.${m}`);
          const Glyph = m === "fullscreen" && active ? Minimize2Icon : Icon;
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
          aria-label={t("qeetaiHeader.collapsePanel")}
          title={t("qeetaiHeader.collapse")}
          onClick={() => workspaceActions.toggleCollapsed()}
        >
          <PanelRightCloseIcon className="size-4" />
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("qeetaiHeader.closeQeetAi")}
        title={t("qeetaiHeader.closeJ")}
        onClick={() => workspaceActions.close()}
      >
        <XIcon className="size-4" />
      </Button>
    </header>
  );
}
