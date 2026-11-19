import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { proxyApiRequest } = vi.hoisted(() => ({ proxyApiRequest: vi.fn() }));

vi.mock("@/platform/auth/auth-lost", () => ({ onAuthLost: vi.fn() }));
vi.mock("@/platform/api/server-proxy", () => ({
  clearServerSession: vi.fn(),
  proxyApiRequest,
  refreshServerSessionNow: vi.fn(),
}));

import { ApiError } from "@/platform/api/client";
import { awaitPushApproval, pushRequestOutcome } from "../mfa-sign-in";

const SESSION = { isAuthenticated: false, version: 1 };

function answer(status: number, data: unknown) {
  proxyApiRequest.mockResolvedValueOnce({ status, data, session: SESSION, sessionChanged: false });
}
const refused = (status: number, code: string) => answer(status, { error: { code, message: "" } });

beforeEach(() => {
  proxyApiRequest.mockReset();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("waiting for a push approval", () => {
  it("asks every two seconds while the phone hasn't answered, and completes once approved", async () => {
    refused(409, "mfa.push_pending");
    answer(200, { session_id: "s" });
    const approved = awaitPushApproval("tok", new AbortController().signal);

    await vi.advanceTimersByTimeAsync(2000);
    expect(proxyApiRequest).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(approved).resolves.toBe(true);
    expect(proxyApiRequest).toHaveBeenCalledTimes(2);
    expect(proxyApiRequest.mock.calls[1]?.[0].data).toMatchObject({
      path: "/v1/auth/mfa",
      method: "POST",
      body: { mfa_token: "tok", push: true },
      anonymous: true,
    });
  });

  it("stops asking as soon as it is cancelled", async () => {
    refused(409, "mfa.push_pending");
    const controller = new AbortController();
    const approved = awaitPushApproval("tok", controller.signal);

    await vi.advanceTimersByTimeAsync(2000);
    controller.abort();
    await expect(approved).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(proxyApiRequest).toHaveBeenCalledTimes(1);
  });

  it("rejects with the server's error once the request has ended", async () => {
    refused(410, "mfa.push_challenge_expired");
    const approved = awaitPushApproval("tok", new AbortController().signal);
    const ended = expect(approved).rejects.toMatchObject({ code: "mfa.push_challenge_expired" });

    await vi.advanceTimersByTimeAsync(2000);
    await ended;
  });
});

describe("how a push request ended", () => {
  it("reads a denial, an unanswered request and any other failure apart", () => {
    expect(pushRequestOutcome(new ApiError(401, "mfa.code_invalid", ""))).toBe("denied");
    expect(pushRequestOutcome(new ApiError(410, "mfa.push_challenge_expired", ""))).toBe("ended");
    expect(pushRequestOutcome(new ApiError(429, "mfa.push_limited", ""))).toBe("failed");
    expect(pushRequestOutcome(new TypeError("Failed to fetch"))).toBe("failed");
  });
});
