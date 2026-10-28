import {
  CheckIcon,
  EllipsisIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  TrashIcon,
  XIcon,
} from "@qeetrix/icons";
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  IconButton,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  VisuallyHidden,
} from "@qeetrix/react";
import { EmptyState, SearchField } from "@qeetrix/react/experimental";
import { useStore } from "@tanstack/react-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useQeetAIRuntime } from "@/modules/qeetai/qeetai-provider";
import {
  conversationActions,
  conversationStore,
  searchConversations,
  sortConversations,
} from "@/modules/qeetai/store/conversation-store";
import { workspaceActions } from "@/modules/qeetai/store/workspace-store";
import type { Conversation } from "@/modules/qeetai/types/qeetai.types";

// Past this, "3 weeks ago" says less than the date itself.
const RELATIVE_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/** When a conversation was last used: relative within a month, the date after. */
function when(ts: number, locale: string, now: number): string {
  return now - ts < RELATIVE_FOR_MS
    ? formatRelativeTime(ts, locale, now)
    : formatDate(ts, locale, { dateStyle: "medium" });
}

/**
 * The person's conversations in this browser: search, then open one, or pin, rename or delete it
 * from its menu. The one that's open carries the Ember bar.
 */
export function HistoryPanel() {
  const { t } = useTranslation("qeetai");
  const conversations = useStore(conversationStore, (s) => s.conversations);
  const activeId = useStore(conversationStore, (s) => s.activeId);
  const [query, setQuery] = useState("");
  const now = Date.now();

  const rows = useMemo(
    () => sortConversations(searchConversations(conversations, query)),
    [conversations, query],
  );

  return (
    <section className="qai-history" aria-label={t("historyPanel.label")}>
      <div className="qai-history-head">
        {conversations.length > 0 ? (
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder={t("historyPanel.searchPlaceholder")}
            aria-label={t("historyPanel.search")}
          />
        ) : null}
        <p>{t("historyPanel.kept")}</p>
      </div>
      <div className="qai-history-body">
        {rows.length === 0 ? (
          <EmptyState
            size="section"
            icon={MessageSquareTextIcon}
            title={t(query ? "historyPanel.noMatches" : "historyPanel.empty")}
            description={query ? undefined : t("historyPanel.emptyText")}
          />
        ) : (
          <ul className="qai-history-list">
            {rows.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                current={conversation.id === activeId}
                now={now}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ConversationRow({
  conversation,
  current,
  now,
}: {
  conversation: Conversation;
  current: boolean;
  now: number;
}) {
  const { t } = useTranslation(["qeetai", "common"]);
  const { confirm } = useQeetAIRuntime();
  const [renaming, setRenaming] = useState(false);
  const locale = formatLocale();
  // A conversation has no title until its first message names it.
  const title = conversation.title || t("historyPanel.untitled");

  async function remove() {
    const ok = await confirm({
      title: t("historyPanel.deleteTitle"),
      body: t("historyPanel.deleteBody", { title }),
      affected: [],
      confirmText: t("common:actions.delete"),
      tone: "destructive",
    });
    if (ok) conversationActions.remove(conversation.id);
  }

  if (renaming) {
    return (
      <li>
        <RenameRow conversation={conversation} onDone={() => setRenaming(false)} />
      </li>
    );
  }

  return (
    <li>
      <div className="qai-history-row" data-current={current ? "" : undefined}>
        <button
          type="button"
          className="qai-history-open"
          aria-current={current ? "true" : undefined}
          onClick={() => {
            conversationActions.setActive(conversation.id);
            workspaceActions.closeHistory();
          }}
        >
          <span className="qai-history-title">
            {conversation.pinned ? (
              <PinIcon shape="sharp" variant="filled" size={14} aria-hidden="true" />
            ) : null}
            <span className="qai-history-name">{title}</span>
            {/* After the title, so the row's name still starts with it. */}
            {conversation.pinned ? (
              <VisuallyHidden>{`, ${t("historyPanel.pinned")}`}</VisuallyHidden>
            ) : null}
          </span>
          <small>
            <time
              dateTime={new Date(conversation.updatedAt).toISOString()}
              title={formatDateTime(conversation.updatedAt, locale)}
            >
              {when(conversation.updatedAt, locale, now)}
            </time>
            {" · "}
            {t("historyPanel.messages", { count: conversation.messages.length })}
          </small>
        </button>
        <Menu>
          <MenuTrigger
            render={
              <IconButton
                icon={EllipsisIcon}
                size="sm"
                tone="neutral"
                aria-label={t("historyPanel.actions", { title })}
              />
            }
          />
          <MenuContent align="end">
            <MenuItem
              icon={conversation.pinned ? PinOffIcon : PinIcon}
              onClick={() => conversationActions.togglePin(conversation.id)}
            >
              {t(conversation.pinned ? "historyPanel.unpin" : "historyPanel.pin")}
            </MenuItem>
            <MenuItem icon={PencilIcon} onClick={() => setRenaming(true)}>
              {t("historyPanel.rename")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={TrashIcon} tone="danger" onClick={() => void remove()}>
              {t("common:actions.delete")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}

/** Renaming in place: the title's field where it was, Save and Cancel after it. */
function RenameRow({ conversation, onDone }: { conversation: Conversation; onDone: () => void }) {
  const { t } = useTranslation(["qeetai", "common"]);
  const [draft, setDraft] = useState(conversation.title);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, []);

  function save() {
    conversationActions.rename(conversation.id, draft);
    onDone();
  }

  return (
    <div className="qai-history-rename">
      <Input
        ref={fieldRef}
        value={draft}
        onValueChange={(value) => setDraft(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onDone();
        }}
        aria-label={t("historyPanel.conversationTitle")}
      />
      <IconButton
        icon={CheckIcon}
        size="sm"
        aria-label={t("historyPanel.saveTitle")}
        onClick={save}
      />
      <IconButton
        icon={XIcon}
        size="sm"
        tone="neutral"
        aria-label={t("common:actions.cancel")}
        onClick={onDone}
      />
    </div>
  );
}
