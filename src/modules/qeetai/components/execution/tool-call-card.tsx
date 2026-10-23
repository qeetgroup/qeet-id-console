import { Button, cn, Spinner } from "@qeetrix/ui";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleDotIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  XIcon,
} from "@qeetrix/icons";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { useSensitiveArtifact } from "../../store/secrets-store";
import { CHANGE_TOOLS_DISABLED, getTool } from "../../tools";
import type { ExecutionStatus, ToolExecution } from "../../tools/types/tool.types";

// A missing capability or invalid input fails the same way on every retry.
const PERMANENT_ERRORS = new Set(["capability_denied", "validation_error"]);

type Tone = "pending" | "running" | "success" | "error";

const STATUS_META: Record<ExecutionStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "pending" },
  validating: { label: "Validating input", tone: "running" },
  awaiting_confirmation: { label: "Awaiting confirmation", tone: "pending" },
  authorizing: { label: "Checking permissions", tone: "running" },
  executing: { label: "Executing", tone: "running" },
  awaiting_step_up: { label: "Awaiting identity check", tone: "pending" },
  succeeded: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "error" },
  timed_out: { label: "Timed out", tone: "error" },
  cancelled: { label: "Cancelled", tone: "pending" },
};

const WITHHELD_META = { label: "Not available in this version", tone: "pending" } as const;

const TONE_TEXT: Record<Tone, string> = {
  pending: "text-muted-foreground",
  running: "text-primary",
  success: "text-success",
  error: "text-destructive",
};

/** Turns a snake_case tool name into a title-cased label. */
function humanize(name: string): string {
  return name
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function StatusGlyph({ tone }: { tone: Tone }) {
  if (tone === "running") return <Spinner size="sm" className="text-primary" />;
  if (tone === "success") return <CheckIcon className="size-4 text-success" />;
  if (tone === "error") return <TriangleAlertIcon className="size-4 text-destructive" />;
  return <CircleDotIcon className="size-4 text-muted-foreground" />;
}

/**
 * Renders one tool execution in the transcript: its live status, redacted result and, for a
 * secret-bearing tool, a one-time reveal of the secret, which is never sent to the model.
 */
export function ToolCallCard({
  execution,
  onRetry,
}: {
  execution: ToolExecution;
  onRetry?: () => void;
}) {
  const [showInput, setShowInput] = useState(false);
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
    <div className="rounded-lg border bg-card/50 text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <StatusGlyph tone={meta.tone} />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{humanize(execution.toolName)}</span>
          <span className={cn("ms-2 text-xs", TONE_TEXT[meta.tone])}>{meta.label}</span>
        </span>
        {execution.status === "cancelled" ? (
          <XIcon className="size-3.5 text-muted-foreground" aria-hidden />
        ) : null}
        <button
          type="button"
          onClick={() => setShowInput((v) => !v)}
          aria-expanded={showInput}
          aria-label={showInput ? "Hide input" : "Show input"}
          className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDownIcon
            className={cn("size-4 transition-transform", showInput && "rotate-180")}
          />
        </button>
      </div>

      {showInput ? (
        <pre className="mx-3 mb-2 overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">
          <code className="font-mono">{JSON.stringify(execution.input, null, 2)}</code>
        </pre>
      ) : null}

      {result?.summary ? (
        <p className="border-t px-3 py-2 text-[13px] text-muted-foreground">{result.summary}</p>
      ) : null}

      {withheld ? <ChangeRefusal toolName={execution.toolName} /> : null}

      {execution.error && !withheld ? (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <TriangleAlertIcon className="size-3.5 shrink-0" />
            {execution.error.code === "execution_error"
              ? "The action could not be completed."
              : execution.error.message}
          </p>
          {retryable && onRetry ? (
            <Button size="xs" variant="ghost" onClick={onRetry}>
              <RotateCcwIcon className="size-3.5" /> Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {artifact ? <SensitiveArtifact artifact={artifact} /> : null}
    </div>
  );
}

/** Renders "nothing was changed", since the assistant only reads, with a link to where to do it. */
function ChangeRefusal({ toolName }: { toolName: string }) {
  const screen = getTool(toolName)?.consoleScreen;
  return (
    <div className="border-t px-3 py-2 text-xs text-muted-foreground" role="status">
      <p>Nothing was changed. The assistant can't make changes in this version.</p>
      {screen ? (
        <Link
          to={screen.to as never}
          className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open {screen.label}
        </Link>
      ) : null}
    </div>
  );
}

function SensitiveArtifact({
  artifact,
}: {
  artifact: NonNullable<ToolExecution["result"]>["sensitiveArtifact"];
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const value = artifact?.value ?? "";

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  if (!artifact) return null;

  return (
    <div className="border-t bg-warning/5 px-3 py-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
        <ShieldAlertIcon className="size-3.5 shrink-0" />
        {artifact.label} — shown once, never sent to the model. Store it securely now.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
          {revealed ? value : "•".repeat(Math.min(value.length, 32))}
        </code>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={revealed ? "Hide" : "Reveal"}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={copied ? "Copied" : "Copy"}
          onClick={copy}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-success" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
