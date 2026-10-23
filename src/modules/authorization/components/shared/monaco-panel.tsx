import { CodeBlock } from "@qeetrix/ui";
import { lazy, Suspense, useEffect, useState } from "react";

import { ClientOnly } from "./client-only";

// Monaco is heavy and browser-only, so it loads lazily; until it mounts, and during SSR, a
// read-only CodeBlock keeps the content visible and copyable.
const MonacoEditor = lazy(() => import("@monaco-editor/react"));

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

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
    <CodeBlock
      value={value}
      language={language === "json" ? "json" : "text"}
      maxHeight={heightStr}
    />
  );

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <div className={className} style={{ height: heightStr }}>
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
              wordWrap: "on",
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
