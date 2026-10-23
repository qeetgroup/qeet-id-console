import { cn } from "@qeetrix/ui";
import { SparklesIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCapabilities } from "@/platform/security/capability-provider";

import { useConsoleContext } from "../../context/use-console-context";
import { rankSuggestions } from "../../suggestions/suggestion-engine";

/**
 * Renders the ranked suggestions for the current route. Picking one sends a prompt
 * suggestion's text, or a tool suggestion's label, as a message. Renders nothing when the
 * route has none.
 */
export function SuggestedActions({
  onPick,
  className,
}: {
  onPick: (text: string) => void;
  className?: string;
}) {
  const { t } = useTranslation("qeetai");
  const context = useConsoleContext();
  const access = useCapabilities();
  const suggestions = useMemo(() => rankSuggestions(context, access.can), [context, access.can]);

  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5 px-3 pt-2", className)}>
      {suggestions.map((suggestion) => (
        <button
          // Labels are unique within a route's suggestion list.
          key={`${suggestion.type}-${suggestion.label}`}
          type="button"
          title={suggestion.description ? t(suggestion.description) : undefined}
          onClick={() =>
            onPick(t(suggestion.type === "prompt" ? suggestion.text : suggestion.label))
          }
          className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SparklesIcon className="size-3 text-primary" aria-hidden />
          {t(suggestion.label)}
        </button>
      ))}
    </div>
  );
}
