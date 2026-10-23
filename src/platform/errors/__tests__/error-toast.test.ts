import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";

import { ApiError } from "../api-error";
import { toastError } from "../error-toast";

const failure = new ApiError(500, "internal", "dial tcp 10.0.3.7", undefined, false, undefined, {
  requestId: "req-9",
});

afterEach(() => vi.mocked(toast.error).mockReset());

describe("toastError", () => {
  it("shows the safe copy with the support reference, never the backend text", () => {
    toastError(failure);
    expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.", {
      description: "Reference: req-9",
    });
  });

  it("moves the copy and reference under a title", () => {
    toastError(failure, "Couldn't revoke the session");
    expect(toast.error).toHaveBeenCalledWith("Couldn't revoke the session", {
      description: "Something went wrong. Please try again. Reference: req-9",
    });
  });

  it("shows the copy alone when there is no reference", () => {
    toastError(new TypeError("Failed to fetch"));
    expect(toast.error).toHaveBeenCalledWith(
      "Can't reach the server. Check your connection and try again.",
    );
  });
});
