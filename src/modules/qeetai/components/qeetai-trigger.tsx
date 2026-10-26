import { SparklesIcon } from "@qeetrix/icons";
import { IconButton } from "@qeetrix/react";
import { useStore } from "@tanstack/react-store";
import { useTranslation } from "react-i18next";

import { useFeatureFlag } from "@/platform/feature-flags/provider";

import { workspaceActions, workspaceStore } from "../store/workspace-store";

/** Renders the top bar's button that toggles the Qeet AI workspace (also ⌘J), while it is on. */
export function QeetAITrigger() {
  const { t } = useTranslation("qeetai");
  const enabled = useFeatureFlag("qeetai");
  const open = useStore(workspaceStore, (s) => s.open);
  if (!enabled) return null;
  return (
    <IconButton
      icon={SparklesIcon}
      tone="neutral"
      aria-label={t("qeetaiTrigger.toggleQeetAi")}
      tooltip={t("qeetaiTrigger.qeetAiJ")}
      aria-pressed={open}
      aria-keyshortcuts="Meta+J Control+J"
      onClick={() => workspaceActions.toggle()}
    />
  );
}
