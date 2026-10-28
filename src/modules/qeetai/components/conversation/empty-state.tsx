import { ArrowRightIcon } from "@qeetrix/icons";
import { mirrorInRtl } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import type { TranslationKey } from "@/i18n";
import type { QeetAIStatus } from "@/modules/qeetai/api/qeetai";

// What its read-only tools can answer (tools/definitions): people by status, the audit log,
// drafting a role it can't create, and Terraform from live settings. Catalogue keys: a picked
// prompt is sent in the operator's language, as if they typed it.
const STARTER_PROMPTS: TranslationKey[] = [
  "qeetai:start.prompts.suspended",
  "qeetai:start.prompts.roleChanges",
  "qeetai:start.prompts.leastPrivilegeRole",
  "qeetai:start.prompts.terraform",
];

// It points forward, so it mirrors in a right-to-left page.
const ForwardIcon = mirrorInRtl(ArrowRightIcon);

// The provider the status names, for "Messages go to …"; another is named as an endpoint.
const PROVIDER_NAMES: Record<string, TranslationKey> = {
  anthropic: "qeetai:providers.anthropic",
  openai: "qeetai:providers.openai",
  azure: "qeetai:providers.azure",
};

/**
 * A new conversation: what Qeet AI can and can't do, prompts to start from (ruled, as the Help
 * panel's rows), and where messages go. Generic, not route-aware: route suggestions appear once
 * a conversation has messages.
 */
export function ConversationStart({
  status,
  onPick,
}: {
  status: QeetAIStatus;
  onPick: (prompt: string) => void;
}) {
  const { t, i18n } = useTranslation("qeetai");
  const provider = i18n.t(PROVIDER_NAMES[status.provider ?? ""] ?? "qeetai:providers.other");
  return (
    <div className="qai-start">
      <div className="qai-start-head">
        <h3>{t("start.title")}</h3>
        <p>{t("start.intro")}</p>
      </div>
      <ul className="qai-prompts" aria-label={t("start.promptsLabel")}>
        {STARTER_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button type="button" className="qai-prompt" onClick={() => onPick(i18n.t(prompt))}>
              <span>{i18n.t(prompt)}</span>
              <ForwardIcon shape="sharp" size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <p className="qai-start-foot">
        {t(status.source === "platform" ? "start.whereQeet" : "start.whereOwn", { provider })}
      </p>
    </div>
  );
}
