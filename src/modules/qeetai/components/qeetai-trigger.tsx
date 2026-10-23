import { useTranslation } from "react-i18next";
import { Button } from "@qeetrix/ui";
import { useStore } from "@tanstack/react-store";
import { SparklesIcon } from "@qeetrix/icons";

import { workspaceActions, workspaceStore } from "../store/workspace-store";

/** Renders the header button that toggles the Qeet AI workspace (also ⌘J). */
export function QeetAITrigger() {
  const { t } = useTranslation("qeetai");
  const open = useStore(workspaceStore, (s) => s.open);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("qeetaiTrigger.toggleQeetAi")}
      aria-pressed={open}
      aria-keyshortcuts="Meta+J Control+J"
      title={t("qeetaiTrigger.qeetAiJ")}
      onClick={() => workspaceActions.toggle()}
      className={open ? "text-primary" : undefined}
    >
      <SparklesIcon />
    </Button>
  );
}
