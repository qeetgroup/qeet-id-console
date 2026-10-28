// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ToolExecution } from "@/modules/qeetai/tools/types/tool.types";

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

    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });

  it.each(["capability_denied", "validation_error"])(
    "offers no retry for %s, which fails the same way every time",
    (code) => {
      render(<ToolCallCard execution={failed(code)} onRetry={vi.fn()} />);

      expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
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
      "This needs the user.read permission, which your account doesn't have.",
    );
    expect(screen.queryByText(/written for the model/)).toBeNull();
  });
});

describe("ToolCallCard result", () => {
  function succeeded(result: ToolExecution["result"]): ToolExecution {
    return { ...failed("unused"), status: "succeeded", error: undefined, result };
  }

  it("tells the operator the tool's own copy, never the summary written for the model", () => {
    render(
      <ToolCallCard
        execution={succeeded({
          ok: true,
          summary: "Found 2 users. (Summary written for the model.)",
          display: { key: "qeetai:toolCallCard.results.usersFound", values: { count: 2 } },
        })}
      />,
    );

    expect(screen.getByText("Found 2 users.")).toBeTruthy();
    expect(screen.queryByText(/written for the model/)).toBeNull();
  });

  it("falls back to a plain done for a tool with no copy of its own", () => {
    render(<ToolCallCard execution={succeeded({ ok: true, summary: "Model-only text." })} />);

    expect(screen.getByText("Done.")).toBeTruthy();
    expect(screen.queryByText("Model-only text.")).toBeNull();
  });
});

describe("ToolCallCard status and input", () => {
  it("says its status in words, and folds the input it sent until asked", () => {
    render(<ToolCallCard execution={failed("execution_error")} />);

    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.queryByText(/"q": "alice"/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show what it sent" }));
    expect(
      screen.getByRole("button", { name: "Hide what it sent" }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByText(/alice/)).toBeTruthy();
  });
});
