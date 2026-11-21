import { Composer as QeetrixComposer } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

/**
 * The message field (Qeetrix's Composer): Enter sends, Shift+Enter adds a line, and Send becomes
 * Stop while an answer streams. It grows with its text up to eight lines, then scrolls, and takes
 * focus as it appears. The note under it says what Qeet AI can and can't do.
 */
export function Composer({ onSend, onStop, isStreaming }: ComposerProps) {
  const { t } = useTranslation("qeetai");
  return (
    <QeetrixComposer
      className="qai-composer"
      aria-label={t("composer.label")}
      onSend={onSend}
      onStop={onStop}
      streaming={isStreaming}
      placeholder={t("composer.placeholder")}
      note={t("composer.note")}
      autoFocus
      maxRows={8}
      messages={{
        composer: t("composer.label"),
        send: t("composer.send"),
        sendShortcut: t("composer.sendShortcut"),
        stop: t("composer.stop"),
      }}
    />
  );
}
