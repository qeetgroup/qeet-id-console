import { describe, expect, it } from "vitest";

import { ApiError } from "../api-error";
import { AppError } from "../app-error";
import { normalizeError } from "../normalize-error";
import { userMessageForCode } from "../user-message";

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
  it("names the password rule that refused a password", () => {
    const shown = (code: string) => {
      const app = normalizeError(new ApiError(422, code, "backend copy"));
      return userMessageForCode(app.code, app.kind);
    };
    const expected: Record<string, RegExp> = {
      "authpolicy.password_too_short": /too short/i,
      "authpolicy.password_no_uppercase": /uppercase letter/i,
      "authpolicy.password_no_number": /a number/i,
      "authpolicy.password_no_symbol": /a symbol/i,
      "authpolicy.password_breached": /known data breaches/i,
    };
    for (const [code, copy] of Object.entries(expected)) {
      expect(shown(code)).toMatch(copy);
      expect(shown(code)).not.toMatch(/aren't valid/i);
    }
  });

  it("says sign-in is temporarily unavailable when the lockout cannot be checked", () => {
    const app = normalizeError(
      new ApiError(503, "auth.sign_in_unavailable", "backend copy", undefined, true),
    );
    expect(userMessageForCode(app.code, app.kind)).toMatch(/temporarily unavailable/i);
  });

  it("points a refused client_credentials grant at service principals", () => {
    const app = normalizeError(
      new ApiError(400, "oidc.grant_type_unsupported", "That grant type isn't supported."),
    );
    expect(userMessageForCode(app.code, app.kind)).toMatch(/service principal/i);
  });

  it("returns curated copy for a known code", () => {
    expect(userMessageForCode("step_up_required", "auth")).toMatch(/identity check/i);
    expect(userMessageForCode("billing.plan_limit", "api")).toMatch(/plan's limit/i);
  });

  it("names the duplicate-email case on signup instead of the generic fallback", () => {
    const app = normalizeError(
      new ApiError(409, "auth.email_exists", "An account with this email already exists."),
    );
    const shown = userMessageForCode(app.code, app.kind);
    expect(shown).toMatch(/already exists/i);
    expect(shown).not.toMatch(/something went wrong/i);
  });

  it("distinguishes the three OTP failures instead of one generic validation message", () => {
    const shown = (code: string) => {
      const app = normalizeError(new ApiError(400, code, "backend copy"));
      return userMessageForCode(app.code, app.kind);
    };
    expect(shown("verification.code_invalid")).toMatch(/isn't correct/i);
    expect(shown("verification.code_used")).toMatch(/already been used/i);
    expect(shown("verification.code_expired")).toMatch(/expired/i);
    expect(
      new Set([
        shown("verification.code_invalid"),
        shown("verification.code_used"),
        shown("verification.code_expired"),
      ]).size,
    ).toBe(3);
  });

  it("tells a locked-out code holder to request a new code, not to retry", () => {
    const app = normalizeError(
      new ApiError(429, "verification.attempts_exceeded", "too many attempts"),
    );
    const shown = userMessageForCode(app.code, app.kind);
    expect(shown).toMatch(/request a new code/i);
    expect(shown).not.toMatch(/something went wrong/i);
  });

  it("explains a throttled resend rather than blaming the request", () => {
    const app = normalizeError(new ApiError(429, "too_many_requests", "rate limited"));
    expect(userMessageForCode(app.code, app.kind)).toMatch(/too many attempts/i);
  });

  it("still explains a 429 that arrives with no error envelope", () => {
    // client.ts synthesises `http_${status}` for a body with no `error` envelope.
    const app = normalizeError(new ApiError(429, "http_429", "Request failed"));
    const shown = userMessageForCode(app.code, app.kind);
    expect(shown).toMatch(/too many attempts/i);
    expect(shown).not.toMatch(/something went wrong/i);
  });

  it("names a bad password instead of blaming the session", () => {
    const app = normalizeError(
      new ApiError(401, "auth.invalid_credentials", "Invalid email or password."),
    );
    const shown = userMessageForCode(app.code, app.kind);
    expect(shown).toBe("Invalid email or password.");
    expect(shown).not.toMatch(/sign in again/i);
  });

  it("never tells a suspended account to just sign in again", () => {
    const app = normalizeError(new ApiError(401, "auth.account_suspended", "suspended"));
    const shown = userMessageForCode(app.code, app.kind);
    expect(shown).toMatch(/administrator/i);
    expect(shown).not.toMatch(/sign in again/i);
  });

  it("names a taken org slug instead of saying 'try again'", () => {
    const app = normalizeError(new ApiError(409, "tenant.slug_taken", "slug taken"));
    expect(app.kind).toBe("api");
    const shown = userMessageForCode(app.code, app.kind);
    expect(shown).toMatch(/already taken/i);
    expect(shown).not.toMatch(/something went wrong/i);
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
