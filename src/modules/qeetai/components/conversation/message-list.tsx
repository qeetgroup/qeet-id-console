import { Conversation } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import type { UseQeetAIChat } from "@/modules/qeetai/hooks/use-qeetai-chat";
import type { Message } from "@/modules/qeetai/types/qeetai.types";
import { MessageItem } from "./message-item";

/**
 * The transcript (Qeetrix's Conversation): it follows new content only while the reader is at the
 * bottom, and it's a polite log, so screen readers hear new turns and streamed text, not removals.
 */
export function MessageList({ messages, chat }: { messages: Message[]; chat: UseQeetAIChat }) {
  const { t } = useTranslation("qeetai");
  return (
    <Conversation className="qai-transcript" messages={{ log: t("transcript.label") }}>
      {messages.map((message, i) => (
        <MessageItem
          key={message.id}
          message={message}
          isLast={i === messages.length - 1}
          chat={chat}
        />
      ))}
    </Conversation>
  );
}
