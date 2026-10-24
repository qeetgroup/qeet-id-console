// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ qeetai: true }));
vi.mock("@/platform/feature-flags/provider", () => ({
  useFeatureFlag: (id: string) => id === "qeetai" && flags.qeetai,
}));
// The workspace has its own tests; here it only has to arrive from its chunk.
vi.mock("../components/qeetai-runtime", () => ({
  QeetAIRuntime: () => <section aria-label="Qeet AI workspace" />,
}));

import { QeetAI, QeetAITrigger } from "..";
import { workspaceActions, workspaceStore } from "../store/workspace-store";

afterEach(() => {
  cleanup();
  act(() => workspaceActions.close());
  flags.qeetai = true;
});

describe("Qeet AI in the shell", () => {
  it("shows the header trigger only while Qeet AI is on", () => {
    flags.qeetai = false;
    const { rerender } = render(<QeetAITrigger />);
    expect(screen.queryByRole("button", { name: "Toggle Qeet AI" })).toBeNull();

    flags.qeetai = true;
    rerender(<QeetAITrigger />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle Qeet AI" }));
    expect(workspaceStore.state.open).toBe(true);
  });

  it("answers ⌘J at once and loads the workspace lazily", async () => {
    render(<QeetAI />);

    fireEvent.keyDown(window, { key: "j", metaKey: true });

    expect(workspaceStore.state.open).toBe(true);
    expect(await screen.findByRole("region", { name: "Qeet AI workspace" })).toBeTruthy();
  });
});
