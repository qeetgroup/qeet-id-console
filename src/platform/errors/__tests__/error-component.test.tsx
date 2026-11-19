// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { cleanup, render, screen } from "@testing-library/react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));
vi.mock("@/platform/telemetry/errors", () => ({ captureError }));

import { ApiError } from "../api-error";
import { RootErrorComponent } from "../error-component";

function show(error: unknown) {
  const props = { error, reset: vi.fn(), info: undefined } as unknown as ErrorComponentProps;
  const view = (
    <QeetrixProvider defaultColorScheme="light">
      <RootErrorComponent {...props} />
    </QeetrixProvider>
  );
  return { ...render(view), view };
}

afterEach(() => {
  cleanup();
  captureError.mockReset();
});

describe("the router's failure screen", () => {
  it("says what went wrong in its own words, with the support reference, never the server's", () => {
    show(
      new ApiError(500, "internal", "pq: connection pool exhausted", undefined, false, undefined, {
        requestId: "req-42",
      }),
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(screen.getByText("req-42")).toBeTruthy();
    expect(screen.queryByText(/connection pool/)).toBeNull();
  });

  it("doesn't blame the connection for a fault in the page", () => {
    show(new TypeError("Cannot read properties of undefined (reading 'organization')"));
    expect(screen.queryByText(/connection/i)).toBeNull();
  });

  it("reports the error once, however often it renders", () => {
    const error = new Error("boom");
    const { rerender, view } = show(error);
    rerender(view);
    rerender(view);
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(error, { source: "error-boundary" });
  });
});
