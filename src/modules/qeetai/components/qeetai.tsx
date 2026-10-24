import { lazy, Suspense } from "react";

import { QeetAILauncher } from "./qeetai-launcher";

// The workspace, chat and tools load in their own chunk, so a console with Qeet AI off never
// downloads them. The workspace starts closed and renders nothing, so loading it late can't flash.
const QeetAIRuntime = lazy(() =>
  import("./qeetai-runtime").then((m) => ({ default: m.QeetAIRuntime })),
);

/** Renders Qeet AI in the shell: the ⌘J shortcut at once, the workspace once its chunk loads. */
export function QeetAI() {
  return (
    <>
      <QeetAILauncher />
      <Suspense fallback={null}>
        <QeetAIRuntime />
      </Suspense>
    </>
  );
}
