import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";
import { AppError } from "./app-error";
import { normalizeError } from "./normalize-error";
import { userMessageForCode } from "./user-message";

describe("normalizeError", () => {
  it("passes AppError through unchanged", () => {
    const app = new AppError("authz", "auth.forbidden", "nope");
    expect(normalizeError(app)).toBe(app);
  });

  it("classifies 401 as auth", () => {
    const out = normalizeError(new ApiError(401, "auth.session_expired", "x"));
    expect(out.kind).toBe("auth");
    expect(out.httpStatus).toBe(401);
  });

  it("classifies step_up_required as auth regardless of status", () => {
    expect(normalizeError(new ApiError(403, "step_up_required", "x")).kind).toBe("auth");
  });

  it("classifies 403 as authz", () => {
    expect(normalizeError(new ApiError(403, "auth.forbidden", "x")).kind).toBe("authz");
  });

  it("classifies 400/422 as validation", () => {
    expect(normalizeError(new ApiError(400, "bad", "x")).kind).toBe("validation");
    expect(normalizeError(new ApiError(422, "bad", "x")).kind).toBe("validation");
  });

  it("classifies other ApiError as api", () => {
    expect(normalizeError(new ApiError(500, "http_500", "x")).kind).toBe("api");
  });

  it("classifies a fetch TypeError as network + retryable", () => {
    const out = normalizeError(new TypeError("Failed to fetch"));
    expect(out.kind).toBe("network");
    expect(out.retryable).toBe(true);
  });

  it("classifies unknown throwables", () => {
    expect(normalizeError("boom").kind).toBe("unknown");
    expect(normalizeError(new Error("x")).kind).toBe("unknown");
  });

  it("preserves the dev detail but not for user display", () => {
    const out = normalizeError(
      new ApiError(500, "http_500", "internal db pool exhausted", "stack"),
    );
    expect(out.devDetail).toBe("stack");
  });
});

describe("userMessageForCode (leak stop)", () => {
  it("returns curated copy for a known code", () => {
    expect(userMessageForCode("step_up_required", "auth")).toMatch(/identity check/i);
    expect(userMessageForCode("billing.plan_limit", "api")).toMatch(/plan's limit/i);
  });

  it("falls back to generic per-kind copy for unknown codes", () => {
    const msg = userMessageForCode("some.internal.code", "api");
    expect(msg).toBe("Something went wrong. Please try again.");
  });

  it("never echoes a raw backend message", () => {
    const raw = 'pq: relation "users" does not exist';
    const app = normalizeError(new ApiError(500, "http_500", raw));
    const shown = userMessageForCode(app.code, app.kind);
    expect(shown).not.toContain(raw);
  });
});
