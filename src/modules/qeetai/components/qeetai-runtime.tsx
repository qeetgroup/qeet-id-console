import { QeetAIRuntimeProvider } from "../qeetai-provider";
import { QeetAIWorkspace } from "./qeetai-workspace";

/** Renders the workspace inside the provider its tools' confirm and step-up dialogs come from. */
export function QeetAIRuntime() {
  return (
    <QeetAIRuntimeProvider>
      {/* Docked, Qeet AI is an in-flow flex sibling, so opening it reflows the page rather
          than covering it. */}
      <QeetAIWorkspace />
    </QeetAIRuntimeProvider>
  );
}
