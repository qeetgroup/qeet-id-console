import { Button } from "@qeetrix/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useConsoleContext } from "@/modules/qeetai/context/use-console-context";
import { rankSuggestions } from "@/modules/qeetai/suggestions/suggestion-engine";
import { useCapabilities } from "@/platform/security/capability-provider";

/**
 * The ranked suggestions for the current page, above the composer: picking one sends a prompt
 * suggestion's text, or a tool suggestion's label, as a message. Nothing when the page has none.
 */
export function SuggestedActions({ onPick }: { onPick: (text: string) => void }) {
  const { t, i18n } = useTranslation("qeetai");
  const context = useConsoleContext();
  const access = useCapabilities();
  const suggestions = useMemo(() => rankSuggestions(context, access.can), [context, access.can]);

  if (suggestions.length === 0) return null;

  return (
    <div className="qai-suggestions">
      <span className="qai-suggestions-label">{t("suggestions.label")}</span>
      {suggestions.map((suggestion) => (
        <Button
          // Labels are unique within a route's suggestion list.
          key={`${suggestion.type}-${suggestion.label}`}
          size="sm"
          variant="ghost"
          tone="neutral"
          title={suggestion.description ? i18n.t(suggestion.description) : undefined}
          onClick={() =>
            onPick(i18n.t(suggestion.type === "prompt" ? suggestion.text : suggestion.label))
          }
        >
          {i18n.t(suggestion.label)}
        </Button>
      ))}
    </div>
  );
}
