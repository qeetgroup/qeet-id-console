import { RotateCcwClockIcon, SquarePenIcon } from "@qeetrix/icons";
import { IconButton } from "@qeetrix/react";
import { useStore } from "@tanstack/react-store";
import { useTranslation } from "react-i18next";

import { conversationActions } from "@/modules/qeetai/store/conversation-store";
import { workspaceActions, workspaceStore } from "@/modules/qeetai/store/workspace-store";
import { PanelBody } from "./panel-body";
import "./qeetai-panel.css";

/**
 * Qeet AI's panel content, inside the frame's AppShell panel (whose header holds its title and
 * Close): New conversation and History in a row at the top, then the body.
 */
export function QeetAIPanel() {
  const { t } = useTranslation("qeetai");
  const historyOpen = useStore(workspaceStore, (s) => s.historyOpen);
  return (
    // The frame is compact; outside it, the panel says so itself, so its sizes match.
    <div className="qai-panel" data-qx-density="compact">
      <div className="qai-panel-tools" role="toolbar" aria-label={t("panel.title")}>
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
      </div>
      <PanelBody />
    </div>
  );
}
