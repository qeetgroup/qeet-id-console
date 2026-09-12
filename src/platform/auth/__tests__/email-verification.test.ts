import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasVerifiedEmail } from "@/platform/auth/email-verification";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/platform/api/client", () => ({ api }));

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("hasVerifiedEmail (route guard)", () => {
  beforeEach(() => {
    // Block body on purpose: `mockReset()` returns the mock, and Vitest treats a
    // function returned from a hook as its teardown callback — so an implicit
    // return here makes it invoke `api()` after every test.
    api.mockReset();
  });

  it("holds an unverified account back", async () => {
    api.mockResolvedValue({ id: "u1", email: "a@b.co", email_verified_at: null });
    expect(await hasVerifiedEmail(client(), "u1")).toBe(false);
  });

  it("lets a verified account through", async () => {
    api.mockResolvedValue({ id: "u1", email: "a@b.co", email_verified_at: "2026-09-12T00:00:00Z" });
    expect(await hasVerifiedEmail(client(), "u1")).toBe(true);
  });

  it("fails OPEN when /me is unreachable, rather than locking the console", async () => {
    // Failing closed would turn a backend blip into a console-wide lockout for
    // every operator. The real gate is server-side (POST /v1/tenants).
    api.mockRejectedValue(new Error("network down"));
    expect(await hasVerifiedEmail(client(), "u1")).toBe(true);
  });

  it("does not call /me without a user id", async () => {
    expect(await hasVerifiedEmail(client(), null)).toBe(true);
    expect(api).not.toHaveBeenCalled();
  });

  it("reuses the useMe cache entry instead of refetching", async () => {
    api.mockResolvedValue({ id: "u1", email: "a@b.co", email_verified_at: null });
    const qc = client();
    await hasVerifiedEmail(qc, "u1");
    await hasVerifiedEmail(qc, "u1");
    expect(api).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(["me", "u1"])).toBeTruthy();
  });
});
