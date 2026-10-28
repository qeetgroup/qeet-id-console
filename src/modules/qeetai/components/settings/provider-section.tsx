import { KeyRoundIcon, PlugZapIcon, SparklesIcon } from "@qeetrix/icons";
import { Badge, Button, formatNumber, Text } from "@qeetrix/react";
import { Anthropic, MicrosoftAzure, Openai } from "@thesvg/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale, type TranslationKey } from "@/i18n";
import type { QeetAIProviderConfig } from "@/modules/qeetai/api/qeetai";
import { type ProviderActions, ProviderForm } from "./provider-form";
import { Item, Panel, Section } from "./settings-parts";

// The reply limit the server uses when none is set (qeetai providercfg.go).
const DEFAULT_REPLY_LIMIT = 4096;

const PROVIDER_NAME: Record<string, TranslationKey> = {
  anthropic: "qeetai:providers.anthropic",
  openai: "qeetai:providers.openai",
  azure: "qeetai:providers.azureShort",
};

/** The provider's mark, in its own colours; Anthropic's and OpenAI's are drawn for dark. */
function ProviderMark({ provider }: { provider?: string }) {
  if (provider === "anthropic") return <Anthropic data-invert="light" />;
  if (provider === "openai") return <Openai data-invert="light" />;
  if (provider === "azure") return <MicrosoftAzure />;
  return <KeyRoundIcon shape="sharp" />;
}

/**
 * The Provider section: the one Qeet AI runs on now (the organisation's own key, the Qeet-managed
 * one, or none) with what it does about it, and the form that opens under its row to connect or
 * change one. What the section says is the server's: whether there's a Qeet-managed key to fall
 * back on, and whether the plan lets the organisation use it.
 */
export function ProviderSection({
  config,
  on,
  canWrite,
  onSave,
  onTest,
  onRemove,
}: ProviderActions & {
  config: QeetAIProviderConfig;
  /** Whether Qeet AI is on, or unknown while the server is asked. */
  on: boolean | undefined;
  canWrite: boolean;
  onRemove: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation("qeetai");
  const [editing, setEditing] = useState(false);
  const own = config.source === "tenant";
  const locale = formatLocale();
  const name = i18n.t(PROVIDER_NAME[config.provider ?? ""] ?? "qeetai:providers.other");
  const facts = [
    config.model,
    own && config.last4 ? t("provider.keyEnding", { last4: config.last4 }) : null,
    t("provider.replies", {
      tokens: formatNumber(config.max_tokens || DEFAULT_REPLY_LIMIT, locale),
    }),
    // The organisation's own endpoint; the Qeet-managed one is the deployment's business.
    own && config.base_url ? config.base_url : null,
  ].filter(Boolean);

  const description = own
    ? t("provider.ownText")
    : config.source === "platform"
      ? t(on === false ? "provider.platformExcluded" : "provider.platformText")
      : // With a Qeet-managed key the server would have resolved to it, so none means neither.
        t("provider.noneText");

  const open = () => setEditing(true);

  const row = own ? (
    <Item
      icon={<ProviderMark provider={config.provider} />}
      name={name}
      badge={
        <Badge tone="success" size="sm">
          {t("provider.connected")}
        </Badge>
      }
      line={<span className="qai-mono-line">{facts.join(" · ")}</span>}
      actions={
        canWrite && !editing ? (
          <>
            <Button variant="ghost" onClick={open}>
              {t("provider.change")}
            </Button>
            <Button variant="ghost" tone="danger" onClick={() => void onRemove()}>
              {t("provider.remove")}
            </Button>
          </>
        ) : null
      }
    />
  ) : config.source === "platform" ? (
    <Item
      icon={<SparklesIcon shape="sharp" />}
      name={t("provider.platformName")}
      badge={
        <Badge tone="neutral" size="sm">
          {t(on === false ? "provider.notInPlan" : "provider.included")}
        </Badge>
      }
      line={<span className="qai-mono-line">{[name, ...facts].join(" · ")}</span>}
      actions={
        canWrite && !editing ? (
          <Button icon={PlugZapIcon} onClick={open}>
            {t("provider.connectOwn")}
          </Button>
        ) : null
      }
    />
  ) : (
    <Item
      icon={<KeyRoundIcon shape="sharp" />}
      name={t("provider.noneName")}
      line={t("provider.noneLine")}
      actions={
        canWrite && !editing ? (
          <Button icon={PlugZapIcon} onClick={open}>
            {t("provider.connect")}
          </Button>
        ) : null
      }
    />
  );

  return (
    <Section title={t("provider.title")} description={description}>
      <ul className="account-rows">
        {row}
        {editing ? (
          <Panel
            title={t(own ? "form.changeTitle" : "form.connectTitle")}
            description={t(own ? "form.changeText" : "form.connectText")}
          >
            <ProviderForm
              config={own ? config : undefined}
              turnsOn={on === false}
              onSave={onSave}
              onTest={onTest}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                toast.success(t(on === false ? "form.savedOn" : "form.saved"));
              }}
            />
          </Panel>
        ) : null}
      </ul>
      {!canWrite ? (
        <Text size="sm" tone="subtle">
          {t("provider.readOnly")}
        </Text>
      ) : null}
    </Section>
  );
}
