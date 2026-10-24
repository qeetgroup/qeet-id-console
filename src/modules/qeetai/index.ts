// Public API of the qeetai module. The shell imports it, so it stays light: the workspace and
// everything it composes load lazily through QeetAI.
export { QeetAI } from "./components/qeetai";
export { QeetAITrigger } from "./components/qeetai-trigger";

// Read-only provider status, for features that show whether Qeet AI is connected.
export { type QeetAIProviderConfig, useQeetAIProviderConfig } from "./api/qeetai";

// Lets a page tell Qeet AI what is on screen.
export { useRegisterContext } from "./context/context-registry";
