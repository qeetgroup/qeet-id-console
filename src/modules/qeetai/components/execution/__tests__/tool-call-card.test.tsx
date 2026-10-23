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
