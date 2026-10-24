import { useTranslation } from "react-i18next";
import { Button } from "@qeetrix/ui";
import { useStore } from "@tanstack/react-store";
import { SparklesIcon } from "@qeetrix/icons";

import { useFeatureFlag } from "@/platform/feature-flags/provider";

import { workspaceActions, workspaceStore } from "../store/workspace-store";

/** Renders the header button that toggles the Qeet AI workspace (also ⌘J), while it is on. */
export function QeetAITrigger() {
  const { t } = useTranslation("qeetai");
  const enabled = useFeatureFlag("qeetai");
  const open = useStore(workspaceStore, (s) => s.open);
  if (!enabled) return null;
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
