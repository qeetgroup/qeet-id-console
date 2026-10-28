import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { UseQeetAIChat } from "@/modules/qeetai/hooks/use-qeetai-chat";
import type { Message } from "@/modules/qeetai/types/qeetai.types";
import { MessageItem } from "./message-item";

/**
 * The scrolling transcript, following new content only while the reader is near the bottom. A
 * native scroll container, not ScrollArea, so it can set scrollTop.
 */
export function MessageList({ messages, chat }: { messages: Message[]; chat: UseQeetAIChat }) {
  const { t } = useTranslation("qeetai");
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the tail on new content
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pinnedToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedToBottom.current = distanceFromBottom < 80;
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="qai-transcript">
      {/* Polite live region: screen readers hear new turns and streamed text, not removals. */}
      <div
        className="qai-log"
        role="log"
        aria-label={t("transcript.label")}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((message, i) => (
          <MessageItem
            key={message.id}
            message={message}
            isLast={i === messages.length - 1}
            chat={chat}
          />
        ))}
      </div>
    </div>
  );
}
