import { ArrowUpIcon, SquareIcon } from "@qeetrix/icons";
import { IconButton, Textarea } from "@qeetrix/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

// Library gap (new): assistant parts, a message composer (a growing field with Send and Stop)
// and transcript turns, built here from Textarea, IconButton and tokens (qeetai-panel.css).
/**
 * The message field: Enter sends, Shift+Enter adds a line, and Send becomes Stop while an answer
 * streams. It grows with its text up to eight lines, then scrolls, and takes focus as it appears.
 */
export function Composer({ onSend, onStop, isStreaming }: ComposerProps) {
  const { t } = useTranslation("qeetai");
  const [draft, setDraft] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => fieldRef.current?.focus(), []);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setDraft("");
  }, [draft, isStreaming, onSend]);

  return (
    <form
      className="qai-composer"
      aria-label={t("composer.label")}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        ref={fieldRef}
        value={draft}
        onValueChange={(value) => setDraft(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        maxRows={8}
        placeholder={t("composer.placeholder")}
        aria-label={t("composer.label")}
      />
      {isStreaming ? (
        <IconButton
          icon={SquareIcon}
          variant="soft"
          aria-label={t("composer.stop")}
          onClick={onStop}
        />
      ) : (
        <IconButton
          type="submit"
          icon={ArrowUpIcon}
          variant="solid"
          aria-label={t("composer.send")}
          tooltip={t("composer.sendShortcut")}
          disabled={!draft.trim()}
        />
      )}
      <p className="qai-composer-note">{t("composer.note")}</p>
    </form>
  );
}
