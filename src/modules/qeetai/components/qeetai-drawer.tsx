import { SparklesIcon } from "@qeetrix/icons";
import type { AppShellDrawer } from "@qeetrix/react/experimental";
import { useStore } from "@tanstack/react-store";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import {
  clampDockWidth,
  MAX_DOCK_WIDTH,
  MIN_DOCK_WIDTH,
  workspaceActions,
  workspaceStore,
} from "../store/workspace-store";

// The panel, chat and tools load in their own chunk, so a console with Qeet AI switched off never
// downloads them; the panel's content loads the first time it opens.
const QeetAIRuntime = lazy(() =>
  import("./qeetai-runtime").then((m) => ({ default: m.QeetAIRuntime })),
);

/** Qeet AI's id among the frame's end-edge panels. */
export const QEETAI_DRAWER = "qeetai";

/**
 * Qeet AI as one of the frame's AppShell panels: its trigger in the top bar, one panel open at a
 * time, the page making room for it, and a start edge that resizes it (the width is remembered).
 * Whether it's open lives in Qeet AI's store, so ⌘J and the console's "Ask Qeet AI" buttons open
 * it as the trigger does.
 */
export function useQeetAIDrawer(enabled: boolean): {
  drawer: AppShellDrawer | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const { t } = useTranslation("qeetai");
  const open = useStore(workspaceStore, (s) => s.open);
  const width = useStore(workspaceStore, (s) => s.dockWidth);
  return {
    drawer: enabled
      ? {
          id: QEETAI_DRAWER,
          label: t("panel.title"),
          icon: SparklesIcon,
          content: (
            <Suspense fallback={null}>
              <QeetAIRuntime />
            </Suspense>
          ),
          width: clampDockWidth(width),
          minWidth: MIN_DOCK_WIDTH,
          maxWidth: MAX_DOCK_WIDTH,
          resizable: true,
          onWidthChange: workspaceActions.setDockWidth,
        }
      : undefined,
    open: enabled && open,
    setOpen: (next) => (next ? workspaceActions.open() : workspaceActions.close()),
  };
}
