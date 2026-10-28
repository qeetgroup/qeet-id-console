import { lazy, Suspense } from "react";

import { QeetAILauncher } from "./qeetai-launcher";

// The panel, chat and tools load in their own chunk, so a console with Qeet AI switched off never
// downloads them. The panel starts closed and renders nothing, so loading it late can't flash.
const QeetAIRuntime = lazy(() =>
  import("./qeetai-runtime").then((m) => ({ default: m.QeetAIRuntime })),
);

/** Renders Qeet AI in the shell: the ⌘J shortcut at once, the panel once its chunk loads. */
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
