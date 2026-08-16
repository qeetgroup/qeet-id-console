// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/platform/errors/api-error";
import { CapabilityProvider } from "../capability-provider";
import {
  SensitiveActionCancelled,
  type SensitiveActionOptions,
  SensitiveActionProvider,
  useSensitiveAction,
} from "../sensitive-action-provider";

afterEach(cleanup);

// Capture the runSensitive function so the test can drive the pipeline directly.
let run: <T>(o: SensitiveActionOptions<T>) => Promise<T | undefined>;
function Capture() {
  run = useSensitiveAction();
  return null;
}

function mount(children: ReactNode = <Capture />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CapabilityProvider>
        <SensitiveActionProvider>{children}</SensitiveActionProvider>
      </CapabilityProvider>
    </QueryClientProvider>,
  );
}

describe("useSensitiveAction", () => {
  it("runs immediately when there is no confirm step", async () => {
    mount();
    const action = vi.fn(async () => "ok");
    let result: unknown;
    await act(async () => {
      result = await run({ run: action });
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result).toBe("ok");
  });

  it("runs only after the confirmation is approved", async () => {
    mount();
    const action = vi.fn(async () => "done");
    let promise!: Promise<unknown>;
    act(() => {
      promise = run({
        confirm: { title: "Delete it?", confirmLabel: "Delete", tone: "destructive" },
        run: action,
      });
    });
    // Confirm dialog is shown; action not called yet.
    const confirmBtn = await screen.findByRole("button", { name: "Delete" });
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(confirmBtn);
    await expect(promise).resolves.toBe("done");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("cancels (rejects, never runs) when confirmation is dismissed", async () => {
    mount();
    const action = vi.fn(async () => "nope");
    let promise!: Promise<unknown>;
    act(() => {
      promise = run({ confirm: { title: "Delete it?", confirmLabel: "Delete" }, run: action });
    });
    const cancelBtn = await screen.findByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    await expect(promise).rejects.toBeInstanceOf(SensitiveActionCancelled);
    expect(action).not.toHaveBeenCalled();
  });

  it("opens the step-up dialog when the backend returns step_up_required", async () => {
    mount();
    const action = vi.fn(async () => {
      throw new ApiError(403, "step_up_required", "needs mfa");
    });
    act(() => {
      void run({ actionLabel: "do the thing", run: action });
    });
    // The run throws step_up_required → the shared StepUpDialog opens for re-auth.
    await waitFor(() => expect(screen.getByText(/confirm it's you/i)).toBeTruthy());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
