import { PencilIcon, RotateCcwIcon, TriangleAlertIcon } from "@qeetrix/icons";
import { Button, IconButton, Spinner, Textarea, VisuallyHidden } from "@qeetrix/react";
import { CopyButton } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { UseQeetAIChat } from "@/modules/qeetai/hooks/use-qeetai-chat";
import type { Message } from "@/modules/qeetai/types/qeetai.types";
import { ExecutionTimeline } from "../execution/execution-timeline";
import { MarkdownMessage } from "../markdown-message/markdown-message";

interface MessageItemProps {
  message: Message;
  isLast: boolean;
  chat: UseQeetAIChat;
}

/**
 * One turn. What the person asked sits at the end on the neutral tint and can be edited and sent
 * again; Qeet AI's answer is Markdown across the panel, with the tools it ran, Copy and, on the
 * last answer, Regenerate. Each turn names its speaker for screen readers.
 */
export function MessageItem({ message, isLast, chat }: MessageItemProps) {
  const { t } = useTranslation("qeetai");

  if (message.role === "user") return <Question message={message} chat={chat} />;

  const streaming = message.status === "streaming";
  const errored = message.status === "error";

  return (
    <div className="qai-turn" data-role="assistant">
      <VisuallyHidden>{t("transcript.assistant")}</VisuallyHidden>
      {message.content ? (
        <MarkdownMessage content={message.content} />
      ) : streaming ? (
        <span className="qai-thinking">
          <Spinner size="sm" decorative />
          {t("messageItem.thinking")}
        </span>
      ) : null}
      {message.toolExecutions && message.toolExecutions.length > 0 ? (
        <ExecutionTimeline executions={message.toolExecutions} />
      ) : null}
      {errored ? (
        <p className="qai-turn-error" role="alert">
          <TriangleAlertIcon shape="sharp" size={16} aria-hidden="true" />
          {message.error ?? t("chat.turnFailed")}
        </p>
      ) : null}
      {!streaming && message.content ? (
        <div className="qai-turn-actions">
          <CopyButton value={message.content} size="sm" label={t("messageItem.copyAnswer")} />
          {isLast ? (
            <IconButton
              icon={RotateCcwIcon}
              size="sm"
              tone="neutral"
              aria-label={t("messageItem.regenerate")}
              onClick={chat.regenerate}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** What the person asked, with Copy and Edit; Edit swaps it for a field and Send. */
function Question({ message, chat }: { message: Message; chat: UseQeetAIChat }) {
  const { t } = useTranslation(["qeetai", "common"]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  // The field takes focus as it replaces the question, so typing can start at once.
  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="qai-turn" data-role="user">
        <div className="qai-edit">
          <Textarea
            ref={editRef}
            value={draft}
            onValueChange={(value) => setDraft(value)}
            rows={3}
            maxRows={8}
            aria-label={t("messageItem.editMessage")}
          />
          <div className="qai-edit-actions">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(message.content);
                setEditing(false);
              }}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!draft.trim()}
              onClick={() => {
                chat.editAndResend(message.id, draft);
                setEditing(false);
              }}
            >
              {t("messageItem.send")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qai-turn" data-role="user">
      <VisuallyHidden>{t("transcript.you")}</VisuallyHidden>
      <div className="qai-question">{message.content}</div>
      <div className="qai-turn-actions">
        <CopyButton value={message.content} size="sm" label={t("messageItem.copyQuestion")} />
        <IconButton
          icon={PencilIcon}
          size="sm"
          tone="neutral"
          aria-label={t("messageItem.editMessage")}
          onClick={() => {
            setDraft(message.content);
            setEditing(true);
          }}
        />
      </div>
    </div>
  );
}
