import { QeetAIRuntimeProvider } from "../qeetai-provider";
import { QeetAIPanel } from "./panel/qeetai-panel";

/** Renders the panel inside the provider its tools' confirm and step-up dialogs come from. */
export function QeetAIRuntime() {
  return (
    <QeetAIRuntimeProvider>
      <QeetAIPanel />
    </QeetAIRuntimeProvider>
  );
}
