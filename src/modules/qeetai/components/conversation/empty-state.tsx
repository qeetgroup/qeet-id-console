import { useTranslation } from "react-i18next";
import { SparklesIcon } from "@qeetrix/icons";
import type { TranslationKey } from "@/i18n";

// Generic, not route-aware: route suggestions appear only once a conversation has messages.
// Catalogue keys; a picked prompt is sent in the operator's language, as if they typed it.
const STARTER_PROMPTS: TranslationKey[] = [
  "qeetai:emptyState.prompts.newDevices",
  "qeetai:emptyState.prompts.leastPrivilegeRole",
  "qeetai:emptyState.prompts.simulateBilling",
  "qeetai:emptyState.prompts.terraformOidc",
];

export function ConversationEmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  const { t, i18n } = useTranslation("qeetai");
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <span
        className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15"
        aria-hidden
      >
        <SparklesIcon className="size-6" />
      </span>
      <h2 className="mt-4 font-heading text-base font-semibold">{t("emptyState.howCanIHelp")}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("emptyState.intro")}</p>
      <ul className="mt-6 flex w-full max-w-md flex-col gap-2">
        {STARTER_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(i18n.t(prompt))}
              className="w-full rounded-lg border bg-card/40 px-3 py-2.5 text-start text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {i18n.t(prompt)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
