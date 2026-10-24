// Monaco from this console's own bundle. @monaco-editor/react otherwise fetches it from jsDelivr,
// which the Content-Security-Policy forbids and which an identity console shouldn't depend on.
// This module is imported lazily, so only the pages with an editor load it.
import { Editor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/language/json/monaco.contribution.js";
import "monaco-editor/languages/definitions/yaml/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import JsonWorker from "monaco-editor/language/json/json.worker.js?worker";

globalThis.MonacoEnvironment = {
  getWorker: (_workerId, label) => (label === "json" ? new JsonWorker() : new EditorWorker()),
};
loader.config({ monaco });

export default Editor;
