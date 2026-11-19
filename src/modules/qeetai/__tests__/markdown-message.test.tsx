// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));

import { MarkdownMessage } from "../components/markdown-message/markdown-message";

afterEach(cleanup);

describe("an answer's markdown", () => {
  it("renders headings and links", () => {
    render(
      <MarkdownMessage content={"##  Who has access\n\nSee [the guide](https://docs.qeet.in)."} />,
    );
    expect(screen.getByRole("heading", { name: "Who has access", level: 4 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /the guide/ }).getAttribute("href")).toBe(
      "https://docs.qeet.in",
    );
  });

  // Model output can echo anyone's data: a run of brackets is read in one pass, as text.
  it("reads a long run of brackets in one pass", () => {
    const started = performance.now();
    render(<MarkdownMessage content={`${"[".repeat(30_000)}x`} />);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
