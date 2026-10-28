// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfirmRequest } from "@/modules/qeetai/tools/types/tool.types";

const runtime = vi.hoisted(() => ({ confirm: vi.fn(async (_req: ConfirmRequest) => true) }));
vi.mock("@/modules/qeetai/qeetai-provider", () => ({
  useQeetAIRuntime: () => ({ confirm: runtime.confirm, stepUp: vi.fn() }),
}));

import { conversationActions, conversationStore } from "@/modules/qeetai/store/conversation-store";
import { workspaceStore } from "@/modules/qeetai/store/workspace-store";
import { HistoryPanel } from "../history-panel";

function start(text: string) {
  conversationActions.create();
  conversationActions.appendMessage({ role: "user", content: text });
  return conversationStore.state.activeId;
}

function row(name: RegExp) {
  const open = screen.getByRole("button", { name });
  const item = open.closest("li");
  if (!item) throw new Error("expected the conversation's row");
  return { open, item: item as HTMLElement };
}

async function choose(item: HTMLElement, action: string) {
  fireEvent.click(within(item).getByRole("button", { name: /^Actions for/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: action }));
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => conversationActions.clearAll());
  runtime.confirm.mockClear();
  runtime.confirm.mockResolvedValue(true);
});

afterEach(cleanup);

describe("Qeet AI history", () => {
  it("says how long conversations are kept, and that there are none yet", () => {
    render(<HistoryPanel />);
    expect(screen.getByText(/Kept in this browser for 30 days/)).toBeTruthy();
    expect(screen.getByText("No conversations yet")).toBeTruthy();
  });

  it("lists conversations, marks the open one and opens another", () => {
    let first: string | null = null;
    act(() => {
      first = start("Which people are suspended?");
      start("Generate Terraform for our applications");
    });
    workspaceStore.setState((s) => ({ ...s, open: true, historyOpen: true }));
    render(<HistoryPanel />);

    const current = row(/^Generate Terraform/);
    expect(current.open.getAttribute("aria-current")).toBe("true");
    expect(within(current.item).getByText(/1 message$/)).toBeTruthy();

    fireEvent.click(row(/^Which people are suspended/).open);
    expect(conversationStore.state.activeId).toBe(first);
    expect(workspaceStore.state.historyOpen).toBe(false);
  });

  it("searches by title and says when nothing matches", () => {
    act(() => {
      start("Which people are suspended?");
      start("Generate Terraform for our applications");
    });
    render(<HistoryPanel />);
    const search = screen.getByRole("searchbox", { name: "Search conversations" });
    fireEvent.change(search, { target: { value: "terraform" } });
    expect(screen.queryByRole("button", { name: /^Which people are suspended/ })).toBeNull();
    expect(row(/^Generate Terraform/)).toBeTruthy();
    fireEvent.change(search, { target: { value: "nothing like this" } });
    expect(screen.getByText("No conversations match")).toBeTruthy();
  });

  it("pins and renames from the row's menu", async () => {
    act(() => {
      start("Which people are suspended?");
    });
    render(<HistoryPanel />);

    await choose(row(/^Which people are suspended/).item, "Pin");
    expect(conversationStore.state.conversations[0]?.pinned).toBe(true);
    expect(within(row(/^Which people are suspended/).item).getByText(/Pinned/)).toBeTruthy();

    await choose(row(/^Which people are suspended/).item, "Rename");
    const field = screen.getByRole("textbox", { name: "Conversation title" });
    fireEvent.change(field, { target: { value: "Suspended people" } });
    fireEvent.click(screen.getByRole("button", { name: "Save title" }));
    expect(conversationStore.state.conversations[0]?.title).toBe("Suspended people");
  });

  it("deletes only after the console's confirm, which says what goes", async () => {
    act(() => {
      start("Which people are suspended?");
    });
    render(<HistoryPanel />);

    runtime.confirm.mockResolvedValueOnce(false);
    await choose(row(/^Which people are suspended/).item, "Delete");
    await waitFor(() => expect(runtime.confirm).toHaveBeenCalledOnce());
    expect(runtime.confirm.mock.calls[0]?.[0]).toMatchObject({
      title: "Delete this conversation?",
      body: expect.stringContaining("removed from this browser"),
      tone: "destructive",
    });
    expect(conversationStore.state.conversations).toHaveLength(1);

    await choose(row(/^Which people are suspended/).item, "Delete");
    await waitFor(() => expect(conversationStore.state.conversations).toHaveLength(0));
  });
});
