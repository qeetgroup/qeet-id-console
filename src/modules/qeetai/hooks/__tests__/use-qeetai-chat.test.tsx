// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider, SendInput, StreamEvent } from "../../ai/ai-provider";
import type { ConsoleContext } from "../../context/types/context.types";

const runtime = vi.hoisted(() => ({
  confirm: vi.fn(async () => true),
  stepUp: vi.fn(async () => true),
  toolCall: { name: "", input: {} as unknown },
  sent: [] as SendInput[],
  context: {
    route: { pathname: "/users", title: "Users" },
    tenantId: "tenant-a",
    userId: "operator-1",
    capabilities: [],
  } as ConsoleContext,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("../../context/use-console-context", () => ({
  useConsoleContext: () => runtime.context,
}));
vi.mock("../../qeetai-provider", () => ({
  useQeetAIRuntime: () => ({ confirm: runtime.confirm, stepUp: runtime.stepUp }),
}));
vi.mock("../../ai/use-active-provider", () => ({ useActiveProvider: () => provider }));

import { api } from "@/platform/api/client";
import { ToolCallCard } from "../../components/execution/tool-call-card";
import { conversationActions, conversationStore } from "../../store/conversation-store";
import { useQeetAIChat } from "../use-qeetai-chat";

// The model asks for one tool, then answers once the tool result comes back.
const provider: AIProvider = {
  id: "test",
  status: async () => ({ configured: true }),
  async *send(input: SendInput): AsyncIterable<StreamEvent> {
    runtime.sent.push(input);
    if (input.toolResults) {
      yield { type: "token", text: "Here is how to do it yourself." };
      yield { type: "done", reason: "end_turn" };
      return;
    }
    yield { type: "tool_call", id: "call_1", ...runtime.toolCall };
    yield { type: "done", reason: "tool_use" };
  },
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

async function ask(text: string) {
  const { result } = renderHook(() => useQeetAIChat(), { wrapper });
  act(() => result.current.send(text));
  await waitFor(() => expect(runtime.sent).toHaveLength(2));
  await waitFor(() => expect(result.current.isStreaming).toBe(false));
  const [toolResult] = runtime.sent[1].toolResults ?? [];
  return toolResult;
}

function lastExecution() {
  const conversation = conversationStore.state.conversations.find(
    (c) => c.id === conversationStore.state.activeId,
  );
  const executions = conversation?.messages.flatMap((m) => m.toolExecutions ?? []) ?? [];
  return executions[executions.length - 1];
}

beforeEach(() => {
  window.localStorage.clear();
  conversationActions.clearAll();
  runtime.sent = [];
  vi.mocked(api).mockReset();
  runtime.confirm.mockClear();
});

afterEach(cleanup);

describe("Qeet AI change requests in 1.0", () => {
  it("refuses to disable a person, changes nothing and says where to do it", async () => {
    runtime.toolCall = { name: "disable_user", input: { user_id: "user-7" } };

    const toolResult = await ask("Disable user-7");

    expect(api).not.toHaveBeenCalled();
    expect(runtime.confirm).not.toHaveBeenCalled();
    expect(toolResult.output).toBeUndefined();
    expect(toolResult.error?.code).toBe("change_tools_disabled");
    expect(toolResult.error?.message).toContain("nothing was changed");
    expect(toolResult.error?.message).toContain("Users screen (/users)");
  });

  it("shows the refusal on the tool card with a link to the screen", async () => {
    runtime.toolCall = { name: "reset_user_mfa", input: { user_id: "user-7" } };
    await ask("Reset MFA for user-7");

    render(<ToolCallCard execution={lastExecution()} onRetry={vi.fn()} />);

    expect(screen.getByText(/Nothing was changed/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Users" }).getAttribute("href")).toBe("/users");
    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("still answers read-only questions with their tool", async () => {
    runtime.toolCall = { name: "search_users", input: { q: "alice" } };
    vi.mocked(api).mockResolvedValue({ items: [] });

    const toolResult = await ask("Find alice");

    expect(api).toHaveBeenCalledOnce();
    expect(vi.mocked(api).mock.calls[0][0]).toBe("/v1/users");
    expect(toolResult.error).toBeUndefined();
    expect(toolResult.output).toBeDefined();
  });
});
