// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/platform/errors/api-error";
import { CapabilityProvider } from "../capability-provider";
import { requestStepUp } from "../step-up-gate";
import {
  SensitiveActionCancelled,
  type SensitiveActionOptions,
  SensitiveActionProvider,
  useSensitiveAction,
} from "../sensitive-action-provider";

afterEach(cleanup);

// The dialog reads the person's factors: an authenticator app and one email factor.
vi.mock("@/platform/api/client", () => ({
  api: vi.fn(async (path: string) => {
    if (path === "/v1/mfa/totp") return { enrolled: true };
    if (path === "/v1/mfa/otp/factors") {
      return {
        items: [{ id: "f1", channel: "email", destination: "j***@example.com", verified: true }],
      };
    }
    return { items: [] };
  }),
}));

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

  it("treats a step-up refusal that reaches it as cancelled", async () => {
    mount();
    const action = vi.fn(async () => {
      throw new ApiError(403, "step_up_required", "needs mfa");
    });
    let promise!: Promise<unknown>;
    act(() => {
      promise = run({ actionLabel: "Do the thing", run: action });
    });
    // The API client has already asked and the person declined, so nothing is asked again.
    await expect(promise).rejects.toBeInstanceOf(SensitiveActionCancelled);
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/confirm it's you/i)).toBeNull();
  });
});

describe("step-up prompt", () => {
  it("opens the step-up dialog for a refused request and reports a cancel", async () => {
    mount();
    let answer!: Promise<boolean>;
    act(() => {
      answer = requestStepUp(new ApiError(403, "step_up_required", "needs mfa"));
    });
    await waitFor(() => expect(screen.getByText(/confirm it's you/i)).toBeTruthy());
    await screen.findByText(/code from your authenticator app/i);
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await expect(answer).resolves.toBe(false);
  });

  it("names the running action exactly as given, beside the copy rather than inside it", async () => {
    mount();
    act(() => {
      void run({
        actionLabel: "Delete SCIM token",
        run: () => requestStepUp(new ApiError(403, "step_up_required", "needs mfa")),
      });
    });
    const label = await screen.findByText("Delete SCIM token");
    // Part of the dialog's accessible description, so a screen reader announces it.
    const describedBy = screen.getByRole("dialog").getAttribute("aria-describedby");
    const description = describedBy ? document.getElementById(describedBy) : null;
    expect(description?.contains(label)).toBe(true);
    expect(description?.textContent).toBe(
      "Delete SCIM token This action needs a fresh check: confirm with one of your second factors.",
    );
  });

  it("offers only the factors the organisation counts", async () => {
    mount();
    act(() => {
      void requestStepUp(
        new ApiError(403, "step_up_required", "needs mfa", undefined, false, {
          allowed_methods: ["otp"],
        }),
      );
    });
    await screen.findByRole("button", { name: /send a code to j\*\*\*@example.com/i });
    expect(screen.queryByText(/code from your authenticator app/i)).toBeNull();
  });
});
