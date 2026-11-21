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

import { QeetAI, useQeetAIDrawer } from "..";
import { MAX_DOCK_WIDTH, workspaceActions, workspaceStore } from "../store/workspace-store";

afterEach(() => {
  cleanup();
  act(() => workspaceActions.close());
  flags.qeetai = true;
});

/** The frame's side of it: the drawer it hosts, its content shown while it's open. */
function Frame({ enabled }: { enabled: boolean }) {
  const qeetai = useQeetAIDrawer(enabled);
  return (
    <>
      <output data-testid="drawer">
        {qeetai.drawer
          ? `${qeetai.drawer.label} ${qeetai.drawer.resizable} ${qeetai.drawer.maxWidth}`
          : "none"}
      </output>
      <button type="button" onClick={() => qeetai.setOpen(!qeetai.open)}>
        {qeetai.open ? "Close it" : "Open it"}
      </button>
      {qeetai.open ? qeetai.drawer?.content : null}
    </>
  );
}

describe("Qeet AI in the shell", () => {
  it("is one of the frame's panels only while Qeet AI is on, resizable to its limits", () => {
    const { rerender } = render(<Frame enabled={false} />);
    expect(screen.getByTestId("drawer").textContent).toBe("none");

    rerender(<Frame enabled />);
    expect(screen.getByTestId("drawer").textContent).toBe(`Qeet AI true ${MAX_DOCK_WIDTH}`);
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    expect(workspaceStore.state.open).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close it" }));
    expect(workspaceStore.state.open).toBe(false);
  });

  it("answers ⌘J at once and loads the workspace lazily", async () => {
    render(
      <>
        <QeetAI />
        <Frame enabled />
      </>,
    );

    fireEvent.keyDown(window, { key: "j", metaKey: true });

    expect(workspaceStore.state.open).toBe(true);
    expect(await screen.findByRole("region", { name: "Qeet AI workspace" })).toBeTruthy();
  });
});
