import { RotateCcwClockIcon, SquarePenIcon, XIcon } from "@qeetrix/icons";
import { IconButton } from "@qeetrix/react";
import { useStore } from "@tanstack/react-store";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";

import { conversationActions } from "@/modules/qeetai/store/conversation-store";
import {
  clampDockWidth,
  MAX_DOCK_WIDTH,
  MIN_DOCK_WIDTH,
  workspaceActions,
  workspaceStore,
} from "@/modules/qeetai/store/workspace-store";
import { PanelBody } from "./panel-body";
import "./qeetai-panel.css";

const RESIZE_STEP = 24;

// Library gap (new): AppShell panels have one width (320px) and can't be resized, which is
// narrow for answers with code; until they can, Qeet AI draws its own panel, as theirs look.
/**
 * Qeet AI's panel on the end edge, under the top bar: drawn as the frame's own panels
 * (Notifications, Help), with its title, New conversation, History and Close, and a start edge
 * that resizes it. From 1200px up the page makes room for it, as it does for the frame's panels;
 * narrower, it floats over the page, and on a phone it takes the whole width.
 */
export function QeetAIPanel() {
  const { t } = useTranslation("qeetai");
  const open = useStore(workspaceStore, (s) => s.open);
  const width = useStore(workspaceStore, (s) => s.dockWidth);
  const historyOpen = useStore(workspaceStore, (s) => s.historyOpen);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  useOnePanelAtATime(open);
  useFocusWhileOpen(open, panelRef);
  useRoomForPanel(open, width);

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      className="qai-panel"
      // The frame is compact; outside it, the panel says so itself, so its sizes match.
      data-qx-density="compact"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ "--qai-panel-width": `${width}px` } as CSSProperties}
    >
      <ResizeHandle width={width} />
      <div className="qai-panel-header">
        <h2 id={titleId} className="qai-panel-title">
          {t("panel.title")}
        </h2>
        <div className="qai-panel-tools">
          <IconButton
            icon={SquarePenIcon}
            size="sm"
            tone="neutral"
            aria-label={t("panel.newConversation")}
            onClick={() => {
              conversationActions.create();
              workspaceActions.closeHistory();
            }}
          />
          <IconButton
            icon={RotateCcwClockIcon}
            size="sm"
            tone="neutral"
            aria-label={t("panel.history")}
            aria-pressed={historyOpen}
            onClick={() => workspaceActions.toggleHistory()}
          />
          <IconButton
            icon={XIcon}
            size="sm"
            tone="neutral"
            aria-label={t("panel.close")}
            aria-keyshortcuts="Meta+J Control+J"
            tooltip={t("panel.closeShortcut")}
            onClick={() => workspaceActions.close()}
          />
        </div>
      </div>
      <PanelBody />
    </aside>
  );
}

/**
 * One panel on the end edge at a time: opening Qeet AI closes the frame's own (Notifications,
 * Help), and opening one of those closes Qeet AI. Until the frame hosts Qeet AI as one of its
 * AppShell panels, the two meet through the AppShell's public parts: its `data-drawer-open`
 * attribute and the Close button in its panel's header (`data-slot` names).
 */
function useOnePanelAtATime(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const shell = document.querySelector<HTMLElement>('[data-slot="app-shell"]');
    if (!shell) return;
    shell.querySelector<HTMLElement>('[data-slot="app-shell-panel-header"] button')?.click();
    const observer = new MutationObserver(() => {
      if (shell.hasAttribute("data-drawer-open")) workspaceActions.close();
    });
    observer.observe(shell, { attributes: true, attributeFilter: ["data-drawer-open"] });
    return () => observer.disconnect();
  }, [open]);
}

/**
 * Moves focus into the panel as it opens (the composer takes it when it's there), and gives it
 * back to where it was, the top bar's button or the page, when the panel closes with it inside.
 */
function useFocusWhileOpen(open: boolean, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      const active = document.activeElement;
      const lost = !active || active === document.body || !!panel?.contains(active);
      if (lost && returnTo?.isConnected) returnTo.focus();
    };
  }, [open, panelRef]);
}

/**
 * The divider on the panel's start edge: dragging resizes it, and ArrowLeft/Right do the same,
 * so it resizes without a pointer.
 */
function ResizeHandle({ width }: { width: number }) {
  const { t } = useTranslation("qeetai");
  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const rtl = getComputedStyle(target).direction === "rtl";
    const move = (ev: globalThis.PointerEvent) => {
      workspaceActions.setDockWidth(rtl ? ev.clientX : window.innerWidth - ev.clientX);
    };
    const up = (ev: globalThis.PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // The panel grows towards the page: leftwards, or rightwards in a right-to-left page.
      const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
      const grow = rtl ? "ArrowRight" : "ArrowLeft";
      const shrink = rtl ? "ArrowLeft" : "ArrowRight";
      if (e.key === grow || e.key === shrink) {
        e.preventDefault();
        workspaceActions.setDockWidth(width + (e.key === grow ? RESIZE_STEP : -RESIZE_STEP));
      }
    },
    [width],
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: <hr> can't be a focusable window splitter
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("panel.resize")}
      aria-valuemin={MIN_DOCK_WIDTH}
      aria-valuemax={MAX_DOCK_WIDTH}
      aria-valuenow={clampDockWidth(width)}
      tabIndex={0}
      className="qai-panel-resize"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}

/**
 * While the panel is open, puts its width on <html> (`data-qai-open`, `--qai-panel-width`), so the
 * page's main area can give way to it (qeetai-panel.css). Until QTRX-75 lets Qeet AI be one of
 * AppShell's own panels, which make room by themselves.
 */
function useRoomForPanel(open: boolean, width: number) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.setAttribute("data-qai-open", "");
    root.style.setProperty("--qai-panel-width", `${width}px`);
    return () => {
      root.removeAttribute("data-qai-open");
      root.style.removeProperty("--qai-panel-width");
    };
  }, [open, width]);
}
