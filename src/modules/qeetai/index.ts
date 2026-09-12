// Public surface of the QeetAI feature. The shell mounts these three in the
// app layout; everything else is an internal module.

export { QeetAILauncher } from "./components/qeetai-launcher";
export { QeetAITrigger } from "./components/qeetai-trigger";
export { QeetAIWorkspace } from "./components/qeetai-workspace";
export { QeetAIRuntimeProvider } from "./qeetai-provider";

// Read-only provider status, so other features (the settings overview) can show
// whether Qeet AI is connected without reaching into this module's internals.
export { type QeetAIProviderConfig, useQeetAIProviderConfig } from "./api/qeetai";
