// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ToolExecution } from "../../../tools/types/tool.types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));

import { ToolCallCard } from "../tool-call-card";

afterEach(cleanup);

function failed(code: string): ToolExecution {
  return {
    id: "call_1",
    toolName: "search_users",
    input: { q: "alice" },
    status: "failed",
    startedAt: 1,
    endedAt: 2,
    attempts: 1,
    error: { code, message: "The action could not be completed." },
  };
}

describe("ToolCallCard retry", () => {
  it("offers a retry for a failure that may pass next time", () => {
    render(<ToolCallCard execution={failed("execution_error")} onRetry={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Retry/ })).toBeTruthy();
  });

  it.each(["capability_denied", "validation_error"])(
    "offers no retry for %s, which fails the same way every time",
    (code) => {
      render(<ToolCallCard execution={failed(code)} onRetry={vi.fn()} />);

      expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
    },
  );
});

describe("ToolCallCard copy", () => {
  it("names the tool by its title and keys the error on its code, not the model's message", () => {
    const execution = failed("capability_denied");
    execution.error = { code: "capability_denied", message: "Text written for the model." };
    render(<ToolCallCard execution={execution} />);

    expect(screen.getByText("Search users")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(
      'This action requires the "user.read" capability, which is not granted to your account.',
    );
    expect(screen.queryByText(/written for the model/)).toBeNull();
  });
});
