import { PlugZapIcon, RefreshCwIcon, SparklesIcon } from "@qeetrix/icons";
import { Button, Skeleton } from "@qeetrix/react";
import { Alert, EmptyState } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useTranslation } from "react-i18next";

import { type QeetAIStatus, useQeetAIStatus } from "@/modules/qeetai/api/qeetai";
import { useQeetAIChat } from "@/modules/qeetai/hooks/use-qeetai-chat";
import { conversationStore } from "@/modules/qeetai/store/conversation-store";
import { workspaceActions, workspaceStore } from "@/modules/qeetai/store/workspace-store";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { Composer } from "../conversation/composer";
import { ConversationStart } from "../conversation/empty-state";
import { MessageList } from "../conversation/message-list";
import { HistoryPanel } from "../history/history-panel";
import { SuggestedActions } from "../suggestions/suggested-actions";

/**
 * What the panel shows: while the server is asked whether Qeet AI is on, a placeholder; if it's
 * off, why and where to turn it on; if on, the conversation. History opens over either, since
 * past conversations stay in this browser.
 */
export function PanelBody() {
  const { t } = useTranslation("qeetai");
  const status = useQeetAIStatus();
  const historyOpen = useStore(workspaceStore, (s) => s.historyOpen);

  if (status.isPending) {
    return (
      <div className="qai-panel-state" role="status" aria-label={t("panel.checking")}>
        <Skeleton lines={2} />
        <Skeleton lines={3} />
      </div>
    );
  }
  if (status.isError) {
    return (
      <div className="qai-panel-state">
        <Alert
          tone="danger"
          title={t("panel.statusFailed")}
          actions={
            <Button
              size="sm"
              variant="soft"
              icon={RefreshCwIcon}
              loading={status.isFetching}
              onClick={() => void status.refetch()}
            >
              {t("panel.tryAgain")}
            </Button>
          }
        >
          {errorMessage(status.error)}
        </Alert>
      </div>
    );
  }
  // `available` also weighs the plan; servers that omit it send only `configured`.
  const on = status.data.available ?? status.data.configured;
  if (on) return <Chat status={status.data} historyOpen={historyOpen} />;
  return historyOpen ? <HistoryPanel /> : <QeetAIOff status={status.data} />;
}

/**
 * The conversation, with its turns kept running while History shows: the chat stays mounted
 * above both views, so opening History doesn't stop an answer.
 */
function Chat({ status, historyOpen }: { status: QeetAIStatus; historyOpen: boolean }) {
  const chat = useQeetAIChat();
  const activeId = useStore(conversationStore, (s) => s.activeId);
  const messages = useStore(
    conversationStore,
    (s) => s.conversations.find((c) => c.id === activeId)?.messages ?? [],
  );

  if (historyOpen) return <HistoryPanel />;
  return (
    <div className="qai-conversation">
      {messages.length === 0 ? (
        <div className="qai-transcript qai-start-scroll">
          <ConversationStart status={status} onPick={chat.send} />
        </div>
      ) : (
        <MessageList messages={messages} chat={chat} />
      )}
      {messages.length > 0 ? <SuggestedActions onPick={chat.send} /> : null}
      <Composer onSend={chat.send} onStop={chat.stop} isStreaming={chat.isStreaming} />
    </div>
  );
}

/**
 * Qeet AI is off, and why, from the server: no provider at all, or the Qeet-managed one on a plan
 * that doesn't include it. Whoever can see the settings gets the way there; anyone else is told
 * who can turn it on.
 */
function QeetAIOff({ status }: { status: QeetAIStatus }) {
  const { t } = useTranslation("qeetai");
  const access = useCapabilities();
  const canChange = access.can("secret.write");
  const canSee = access.can("secret.read");
  const settings = <RouterLink to="/settings/qeet-ai" onClick={() => workspaceActions.close()} />;
  return (
    <div className="qai-panel-state">
      <EmptyState
        size="section"
        icon={SparklesIcon}
        title={t("off.title")}
        description={t(status.source === "platform" ? "off.plan" : "off.none")}
        actions={
          canSee ? (
            // A link drawn as a button; Base UI warns of it in development (QTRX-8).
            <Button
              render={settings}
              variant={canChange ? "solid" : "soft"}
              icon={canChange ? PlugZapIcon : undefined}
            >
              {t(canChange ? "off.connect" : "off.settings")}
            </Button>
          ) : null
        }
      >
        {canSee ? null : t("off.askAdmin")}
      </EmptyState>
    </div>
  );
}
