// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { useCompleteMfaLogin } from "../../api/flows";
import { MfaChallengeStep } from "../mfa-challenge-step";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("../../api/flows", () => ({ useCompleteMfaLogin: vi.fn() }));
vi.mock("../../api/mfa-sign-in", () => ({
  completeWithPush: vi.fn(),
  mfaPasskeyProof: vi.fn(),
  sendMfaCode: vi.fn(),
  startMfaEnrollment: vi.fn(),
}));

const mutate = vi.fn();
function completion(data?: { recovery_codes?: string[] }) {
  vi.mocked(useCompleteMfaLogin).mockReturnValue({
    mutate,
    isPending: false,
    error: null,
    data,
  } as unknown as ReturnType<typeof useCompleteMfaLogin>);
}

beforeEach(() => {
  vi.clearAllMocks();
  completion();
});
afterEach(cleanup);

describe("a sign-in's second-factor challenge", () => {
  it("asks for a factor the account holds and completes the challenge with it", () => {
    render(
      <MfaChallengeStep
        challenge={{
          mfa_required: true,
          mfa_token: "tok",
          methods: ["totp"],
          factors: [{ type: "totp" }],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Two-factor authentication" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(mutate).toHaveBeenCalledWith({ mfa_token: "tok", code: "123456" });
  });

  it("sets up an authenticator app when the account must have one", () => {
    render(
      <MfaChallengeStep
        challenge={{
          mfa_required: true,
          mfa_token: "tok",
          methods: ["totp"],
          factors: [],
          enrollment_required: true,
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Set up two-step verification" })).toBeTruthy();
  });

  it("shows the recovery codes the setup minted, then opens the console", () => {
    completion({ recovery_codes: ["aaaa-bbbb"] });
    render(
      <MfaChallengeStep
        challenge={{
          mfa_required: true,
          mfa_token: "tok",
          methods: ["totp"],
          enrollment_required: true,
        }}
      />,
    );
    expect(screen.getByText("aaaa-bbbb")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
