import {
  BanIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDotIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import { Badge, type BadgeTone, Button, Field, IconButton, Link, Spinner } from "@qeetrix/react";
import { CodeBlock, CopyButton, PasswordInput } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { TranslationKey } from "@/i18n";
import { useSensitiveArtifact } from "@/modules/qeetai/store/secrets-store";
import { CHANGE_TOOLS_DISABLED, getTool } from "@/modules/qeetai/tools";
import type { ExecutionStatus, ToolExecution } from "@/modules/qeetai/tools/types/tool.types";

// A missing capability or invalid input fails the same way on every retry.
const PERMANENT_ERRORS = new Set(["capability_denied", "validation_error"]);

type Tone = "pending" | "running" | "success" | "error" | "withheld";

// Labels are catalogue keys, translated at render; each is a word or two, for the status tag.
const STATUS_META: Record<ExecutionStatus, { label: TranslationKey; tone: Tone }> = {
  queued: { label: "qeetai:toolCallCard.status.queued", tone: "pending" },
  validating: { label: "qeetai:toolCallCard.status.validating", tone: "running" },
  awaiting_confirmation: {
    label: "qeetai:toolCallCard.status.awaitingConfirmation",
    tone: "pending",
  },
  authorizing: { label: "qeetai:toolCallCard.status.authorizing", tone: "running" },
  executing: { label: "qeetai:toolCallCard.status.executing", tone: "running" },
  awaiting_step_up: { label: "qeetai:toolCallCard.status.awaitingStepUp", tone: "pending" },
  succeeded: { label: "qeetai:toolCallCard.status.succeeded", tone: "success" },
  failed: { label: "qeetai:toolCallCard.status.failed", tone: "error" },
  timed_out: { label: "qeetai:toolCallCard.status.timedOut", tone: "error" },
  cancelled: { label: "qeetai:toolCallCard.status.cancelled", tone: "pending" },
};

const WITHHELD_META = { label: "qeetai:toolCallCard.status.withheld", tone: "withheld" } as const;

const BADGE_TONE: Record<Tone, BadgeTone> = {
  pending: "neutral",
  running: "info",
  success: "success",
  error: "danger",
  withheld: "neutral",
};

// An execution error's message is written for the model, so the card shows copy keyed on its
// code; any other code gets the generic failure.
const ERROR_COPY: Record<string, TranslationKey> = {
  capability_denied: "qeetai:toolCallCard.errors.capabilityDenied",
  validation_error: "qeetai:toolCallCard.errors.invalidInput",
  timeout: "qeetai:toolCallCard.errors.timedOut",
  unknown_tool: "qeetai:toolCallCard.errors.unknownTool",
  tool_not_enabled: "qeetai:toolCallCard.errors.notEnabled",
};

/** Turns a snake_case tool name into a sentence-case label, for a tool the registry lacks. */
function humanize(name: string): string {
  const words = name.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The status in the tone's colour, beside the word that carries it. */
function StatusGlyph({ tone }: { tone: Tone }) {
  if (tone === "running") return <Spinner size="sm" decorative />;
  const Icon = {
    success: CircleCheckIcon,
    error: TriangleAlertIcon,
    withheld: BanIcon,
    pending: CircleDotIcon,
  }[tone];
  return <Icon shape="sharp" size={16} aria-hidden="true" />;
}

/**
 * One tool Qeet AI ran, in the transcript: its name and status, the input it sent (folded), what
 * came back in the tool's own words, why it failed, and, for a tool that mints a secret, that
 * secret shown once to the person and never sent to the model.
 */
export function ToolCallCard({
  execution,
  onRetry,
}: {
  execution: ToolExecution;
  onRetry?: () => void;
}) {
  const { t, i18n } = useTranslation("qeetai");
  const [showInput, setShowInput] = useState(false);
  const tool = getTool(execution.toolName);
  // A change tool withheld in this version: not a failure, and retrying can't help.
  const withheld = execution.error?.code === CHANGE_TOOLS_DISABLED;
  const meta = withheld ? WITHHELD_META : STATUS_META[execution.status];
  const result = execution.result;
  // Secrets come from the in-memory secrets store, never localStorage.
  const artifact = useSensitiveArtifact(execution.id);
  const retryable =
    !withheld &&
    (execution.status === "failed" || execution.status === "timed_out") &&
    !PERMANENT_ERRORS.has(execution.error?.code ?? "");

  return (
    <div className="qai-tool" data-tone={meta.tone}>
      <div className="qai-tool-head">
        <span className="qai-tool-icon">
          <StatusGlyph tone={meta.tone} />
        </span>
        <span className="qai-tool-name">
          <strong>{tool ? i18n.t(tool.title) : humanize(execution.toolName)}</strong>
          <Badge size="sm" tone={BADGE_TONE[meta.tone]}>
            {i18n.t(meta.label)}
          </Badge>
        </span>
        <IconButton
          icon={ChevronDownIcon}
          size="sm"
          tone="neutral"
          aria-label={t(showInput ? "toolCallCard.hideInput" : "toolCallCard.showInput")}
          aria-expanded={showInput}
          onClick={() => setShowInput((v) => !v)}
        />
      </div>

      {showInput ? (
        <div className="qai-tool-section">
          <CodeBlock
            code={JSON.stringify(execution.input ?? {}, null, 2)}
            language="json"
            title={t("toolCallCard.input")}
            wrap
          />
        </div>
      ) : null}

      {/* `summary` is the model's English; the operator reads the tool's own copy. */}
      {result?.ok ? (
        <div className="qai-tool-section">
          <p className="qai-tool-result">
            {result.display
              ? i18n.t(result.display.key, result.display.values)
              : i18n.t("qeetai:toolCallCard.results.done")}
          </p>
        </div>
      ) : null}

      {withheld ? <ChangeRefusal toolName={execution.toolName} /> : null}

      {execution.error && !withheld ? (
        <div className="qai-tool-section qai-tool-failure">
          <p className="qai-turn-error" role="alert">
            <TriangleAlertIcon shape="sharp" size={16} aria-hidden="true" />
            {i18n.t(ERROR_COPY[execution.error.code] ?? "qeetai:toolCallCard.errors.failed", {
              capability: tool?.requiredCapability,
            })}
          </p>
          {retryable && onRetry ? (
            <Button size="sm" variant="ghost" icon={RotateCcwIcon} onClick={onRetry}>
              {t("toolCallCard.retry")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {artifact ? <SensitiveArtifact artifact={artifact} /> : null}
    </div>
  );
}

/** "Nothing was changed", since Qeet AI only reads, with a link to the page to do it on. */
function ChangeRefusal({ toolName }: { toolName: string }) {
  const { t, i18n } = useTranslation("qeetai");
  const screen = getTool(toolName)?.consoleScreen;
  return (
    <div className="qai-tool-section" role="status">
      <p className="qai-tool-result">{t("toolCallCard.nothingWasChangedThe")}</p>
      {screen ? (
        <p>
          <Link render={<RouterLink to={screen.to as never} />}>
            {t("toolCallCard.openScreen", { screen: i18n.t(screen.label) })}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** A secret a tool minted, on the warning tint: hidden until shown, with Copy beside it. */
function SensitiveArtifact({
  artifact,
}: {
  artifact: NonNullable<NonNullable<ToolExecution["result"]>["sensitiveArtifact"]>;
}) {
  const { t } = useTranslation("qeetai");
  return (
    <div className="qai-tool-section qai-tool-secret">
      <Field label={artifact.label} description={t("toolCallCard.secretNotice")}>
        <PasswordInput
          value={artifact.value}
          readOnly
          autoComplete="off"
          capsLockWarning={false}
          endAdornment={
            <CopyButton value={artifact.value} size="sm" label={t("toolCallCard.copySecret")} />
          }
        />
      </Field>
    </div>
  );
}
