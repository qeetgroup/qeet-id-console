import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";
import { api, ApiError } from "@/platform/api/client";

import { passkeyErrorMessage, signInWithPasskey, signUpWithPasskey } from "../passkey-flows";

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: vi.fn(),
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));
vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

const publicKey = { challenge: "dGVzdA", rpId: "localhost" };
const credential = { id: "credential-1", type: "public-key", response: {} };
const session = { user_id: "user-1", session_id: "session-1", expires_at: "2030-01-01T00:00:00Z" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
  vi.mocked(api)
    .mockResolvedValueOnce({ session_id: "ceremony-1", publicKey })
    .mockResolvedValueOnce(session);
  vi.mocked(startAuthentication).mockResolvedValue(credential as never);
  vi.mocked(startRegistration).mockResolvedValue(credential as never);
});

describe("console passkey ceremonies", () => {
  it("performs discoverable login through the BFF and returns only public metadata", async () => {
    expect(await signInWithPasskey()).toEqual(session);
    expect(api).toHaveBeenNthCalledWith(1, "/v1/passkeys/login/begin", {
      method: "POST",
      body: {},
      anonymous: true,
    });
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: publicKey });
    expect(api).toHaveBeenNthCalledWith(2, "/v1/passkeys/login/finish", {
      method: "POST",
      body: { session_id: "ceremony-1", credential },
      anonymous: true,
    });
  });

  it("uses the actual tenant-less signup contract without sending a password", async () => {
    const input = { email: "jane@example.com", display_name: "Jane Doe" };
    expect(await signUpWithPasskey(input)).toEqual(session);
    expect(api).toHaveBeenNthCalledWith(1, "/v1/signup/passkey/begin", {
      method: "POST",
      body: input,
      anonymous: true,
    });
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: publicKey });
    expect(api).toHaveBeenNthCalledWith(2, "/v1/signup/passkey/finish", {
      method: "POST",
      body: { session_id: "ceremony-1", credential },
      anonymous: true,
    });
  });

  it("does not call the backend on unsupported browsers", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    await expect(signInWithPasskey()).rejects.toThrow();
    const signup = signUpWithPasskey({ email: "jane@example.com", display_name: "Jane" });
    await expect(signup).rejects.toThrow();
    expect(api).not.toHaveBeenCalled();
  });

  it("does not finish a cancelled credential request and gives safe recovery copy", async () => {
    const error = new Error("private device information");
    error.name = "NotAllowedError";
    vi.mocked(startAuthentication).mockRejectedValue(error);
    await expect(signInWithPasskey()).rejects.toBe(error);
    expect(api).toHaveBeenCalledTimes(1);
    expect(passkeyErrorMessage(error)).toContain("No passkey was selected");
    expect(passkeyErrorMessage(error)).not.toContain("private device information");
  });

  it("never displays backend or browser exception details", () => {
    const backendError = new ApiError(500, "internal", "private database hostname");
    expect(passkeyErrorMessage(backendError)).not.toContain("private database hostname");
    expect(passkeyErrorMessage(new Error("private browser details"))).not.toContain(
      "private browser details",
    );
  });
});
