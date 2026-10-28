import { CodeBlock } from "@qeetrix/react/experimental";
import { lazy, Suspense } from "react";

import { useIsDark } from "@/platform/theme/use-is-dark";
import { ClientOnly } from "./client-only";

// Until @qeetrix/react has an editable code field (CodeBlock is read-only): Monaco. It is heavy and
// browser-only, so it loads lazily, from this console's own bundle; until it mounts, and during
// SSR, a read-only CodeBlock keeps the content visible and copyable.
const MonacoEditor = lazy(() => import("./monaco-editor"));

export interface MonacoPanelProps {
  value: string;
  language?: "json" | "yaml" | "plaintext";
  readOnly?: boolean;
  onChange?: (value: string) => void;
  height?: number | string;
  className?: string;
  ariaLabel?: string; // accessible name for the editor
}

export function MonacoPanel({
  value,
  language = "json",
  readOnly = true,
  onChange,
  height = 320,
  className,
  ariaLabel,
}: MonacoPanelProps) {
  const dark = useIsDark();
  const heightStr = typeof height === "number" ? `${height}px` : height;
  const fallback = (
    <div className="ws-editor-fallback" style={{ maxBlockSize: heightStr }}>
      <CodeBlock code={value} language={language === "json" ? "json" : "text"} />
    </div>
  );

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <div
          className={className ? `ws-editor ${className}` : "ws-editor"}
          style={{ height: heightStr }}
        >
          <MonacoEditor
            height="100%"
            language={language}
            theme={dark ? "vs-dark" : "light"}
            value={value}
            loading={fallback}
            onChange={(v) => onChange?.(v ?? "")}
            options={{
              // The label belongs on Monaco's focusable textarea; a wrapper div can't carry it.
              ...(ariaLabel ? { ariaLabel } : {}),
              readOnly,
              domReadOnly: readOnly,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "off",
              padding: { top: 10, bottom: 10 },
              renderLineHighlight: readOnly ? "none" : "line",
              overviewRulerLanes: 0,
              scrollbar: { alwaysConsumeMouseWheel: false },
            }}
          />
        </div>
      </Suspense>
    </ClientOnly>
  );
}
