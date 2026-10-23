import { useEffect, useRef } from "react";

import type { UseQeetAIChat } from "../../hooks/use-qeetai-chat";
import type { Message } from "../../types/qeetai.types";
import { MessageItem } from "./message-item";

/**
 * Renders the scrolling transcript, following new content only while the reader is near the
 * bottom. A native scroll container, not ScrollArea, so it can set scrollTop.
 */
export function MessageList({ messages, chat }: { messages: Message[]; chat: UseQeetAIChat }) {
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
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
    >
      {/* Polite live region: screen readers hear new turns and streamed text, not removals. */}
      <div
        className="mx-auto flex max-w-3xl flex-col gap-5"
        role="log"
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
