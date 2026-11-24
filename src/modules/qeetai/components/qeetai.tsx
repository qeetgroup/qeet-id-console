import { QeetAILauncher } from "./qeetai-launcher";

/**
 * Qeet AI's shortcut in the shell: ⌘J / Ctrl+J opens and closes its panel, which the frame hosts as
 * one of its AppShell panels (useQeetAIDrawer).
 */
export function QeetAI() {
  return <QeetAILauncher />;
}
