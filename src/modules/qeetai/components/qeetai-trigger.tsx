import { MagicStar } from "@qeetrix/icons";
import { Button } from "@qeetrix/ui";
import { useStore } from "@tanstack/react-store";

import { workspaceActions, workspaceStore } from "../store/workspace-store";

/** Header affordance that toggles the QeetAI workspace (also bound to ⌘J). */
export function QeetAITrigger() {
  const open = useStore(workspaceStore, (s) => s.open);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle Qeet AI"
      aria-pressed={open}
      aria-keyshortcuts="Meta+J Control+J"
      title="Qeet AI (⌘J)"
      onClick={() => workspaceActions.toggle()}
      className={open ? "text-primary" : undefined}
    >
      <MagicStar />
    </Button>
  );
}
