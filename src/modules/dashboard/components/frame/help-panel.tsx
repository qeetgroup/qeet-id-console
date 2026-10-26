import { BookOpenIcon, KeyboardIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { DOCS_URL } from "@/platform/config/site-urls";

/** The Help panel: the docs, and the keyboard shortcuts the console already has. */
export function HelpPanel({ onShortcuts }: { onShortcuts: () => void }) {
  const { t } = useTranslation("dashboard");
  return (
    <ul className="frame-help">
      <li>
        <a className="frame-help-row" href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          <BookOpenIcon shape="sharp" size={16} aria-hidden="true" />
          <span>
            <strong>{t("frame.help.docs")}</strong>
            <small>{t("frame.help.docsText")}</small>
          </span>
        </a>
      </li>
      <li>
        <button type="button" className="frame-help-row" onClick={onShortcuts}>
          <KeyboardIcon shape="sharp" size={16} aria-hidden="true" />
          <span>
            <strong>{t("frame.help.shortcuts")}</strong>
            <small>{t("frame.help.shortcutsText")}</small>
          </span>
        </button>
      </li>
    </ul>
  );
}
