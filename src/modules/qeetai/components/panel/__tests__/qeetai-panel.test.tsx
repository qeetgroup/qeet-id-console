// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  status: { configured: false, available: false, source: "none" } as Record<string, unknown>,
  statusFails: false,
  permissions: new Set<string>(["secret.read", "secret.write"]),
  send: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));
vi.mock("@/platform/api/client", () => ({
  api: vi.fn(async (path: string) => {
    if (path !== "/v1/qeetai/status") throw new Error(`unexpected ${path}`);
    if (env.statusFails) throw new Error("internal detail");
    return env.status;
  }),
}));
vi.mock("@/platform/auth/session", () => ({ useOrganizationId: () => "tenant-a" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: (c?: string) => !c || env.permissions.has(c) }),
}));
vi.mock("@/modules/qeetai/context/use-console-context", () => ({
  useConsoleContext: () => ({
    route: { pathname: "/users", title: "Users" },
    organizationId: "tenant-a",
    userId: "operator-1",
    capabilities: [],
  }),
}));
vi.mock("@/modules/qeetai/hooks/use-qeetai-chat", () => ({
  useQeetAIChat: () => ({
    isStreaming: false,
    isThinking: false,
    send: env.send,
    regenerate: vi.fn(),
    editAndResend: vi.fn(),
    stop: vi.fn(),
  }),
}));
vi.mock("@/modules/qeetai/qeetai-provider", () => ({
  useQeetAIRuntime: () => ({ confirm: vi.fn(async () => true), stepUp: vi.fn() }),
}));

import { conversationActions } from "@/modules/qeetai/store/conversation-store";
import { workspaceActions, workspaceStore } from "@/modules/qeetai/store/workspace-store";
import { QeetAIPanel } from "../qeetai-panel";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function openPanel() {
  render(<QeetAIPanel />, { wrapper });
  act(() => workspaceActions.open());
}

beforeEach(() => {
  window.localStorage.clear();
  conversationActions.clearAll();
  env.status = { configured: false, available: false, source: "none" };
  env.statusFails = false;
  env.permissions = new Set(["secret.read", "secret.write"]);
  env.send.mockClear();
});

afterEach(() => {
  act(() => workspaceActions.close());
  cleanup();
  document.body.innerHTML = "";
});

describe("Qeet AI panel", () => {
  // The frame's AppShell panel draws its edge, header, Close and resizing; this is its content.
  it("starts with New conversation and History, compact as the frame", async () => {
    openPanel();
    const tools = screen.getByRole("toolbar", { name: "Qeet AI" });
    expect(tools.closest("[data-qx-density]")?.getAttribute("data-qx-density")).toBe("compact");
    expect(screen.getByRole("button", { name: "New conversation" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Conversation history" }));
    expect(workspaceStore.state.historyOpen).toBe(true);
    expect(await screen.findByRole("region", { name: "Conversation history" })).toBeTruthy();
  });

  it("says Qeet AI is off and why, with the way to connect a provider, and no composer", async () => {
    openPanel();
    expect(await screen.findByText("Qeet AI is off")).toBeTruthy();
    expect(screen.getByText(/no Qeet-managed one to fall back on/)).toBeTruthy();
    const connect = screen.getByRole("link", { name: /Connect a provider/ });
    expect(connect.getAttribute("href")).toBe("/settings/qeet-ai");
    expect(screen.queryByRole("textbox", { name: "Message Qeet AI" })).toBeNull();
  });

  it("names the plan when only the Qeet-managed provider is set up and the plan excludes it", async () => {
    env.status = { configured: true, available: false, source: "platform", provider: "anthropic" };
    openPanel();
    expect(await screen.findByText(/Your plan doesn't include the Qeet-managed/)).toBeTruthy();
  });

  it("tells someone who can't see the settings who can turn it on", async () => {
    env.permissions = new Set();
    openPanel();
    expect(await screen.findByText(/An administrator can connect one/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Connect a provider/ })).toBeNull();
  });

  it("shows a safe failure with Try again when the status can't be read", async () => {
    env.statusFails = true;
    openPanel();
    expect(await screen.findByText("Couldn't check whether Qeet AI is on")).toBeTruthy();
    expect(screen.queryByText(/internal detail/)).toBeNull();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });

  it("offers the conversation once it's on: what it can do, prompts and the composer", async () => {
    env.status = { configured: true, available: true, source: "tenant", provider: "anthropic" };
    openPanel();
    expect(await screen.findByText("Ask about this organisation")).toBeTruthy();
    expect(screen.getByText(/It can't make changes/)).toBeTruthy();
    expect(
      screen.getByText(/Messages go to Anthropic, on your organisation's account/),
    ).toBeTruthy();
    const composer = screen.getByRole("textbox", { name: "Message Qeet AI" });
    expect(document.activeElement).toBe(composer);
    fireEvent.click(screen.getByRole("button", { name: /Which people are suspended/ }));
    expect(env.send).toHaveBeenCalledWith("Which people are suspended?");
  });

  it("sends on Enter, keeps Shift+Enter for a new line", async () => {
    env.status = { configured: true, available: true, source: "tenant" };
    openPanel();
    const composer = await screen.findByRole("textbox", { name: "Message Qeet AI" });
    fireEvent.change(composer, { target: { value: "Who is suspended?" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    expect(env.send).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(env.send).toHaveBeenCalledWith("Who is suspended?");
  });
});
