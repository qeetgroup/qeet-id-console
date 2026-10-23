// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { errorMessage } from "@/platform/errors/user-message";

import { startMfaEnrollment } from "@/modules/authentication/api/mfa-sign-in";
import { MfaEnrollmentStep, RecoveryCodesStep } from "../mfa-enrollment-step";

vi.mock("@/modules/authentication/api/mfa-sign-in", () => ({ startMfaEnrollment: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(startMfaEnrollment).mockResolvedValue({
    secret: "JBSWY3DPEHPK3PXP",
    provisioning_url: "otpauth://totp/Qeet:jane@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Qeet",
  });
});
afterEach(cleanup);

describe("sign-in authenticator app setup", () => {
  it("sets up the app for the challenge and completes it with a code", async () => {
    const onSubmit = vi.fn();
    render(<MfaEnrollmentStep mfaToken="tok" isLoading={false} onSubmit={onSubmit} />);
    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Set up an authenticator app" }));
    await waitFor(() => expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeTruthy());
    expect(startMfaEnrollment).toHaveBeenCalledWith("tok");

    fireEvent.change(screen.getByLabelText("Code from the app"), { target: { value: " 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and sign in" }));
    expect(onSubmit).toHaveBeenCalledWith({ code: "123456" });
  });

  it("offers to skip only while the grace period runs", () => {
    const onSubmit = vi.fn();
    render(
      <MfaEnrollmentStep
        mfaToken="tok"
        dueAt="2026-11-01T00:00:00Z"
        isLoading={false}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/requires a second step when you sign in from/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(onSubmit).toHaveBeenCalledWith({ skip: true });
  });

  it("shows a setup failure and lets the person try again", async () => {
    vi.mocked(startMfaEnrollment).mockRejectedValue(new Error("boom"));
    render(<MfaEnrollmentStep mfaToken="tok" isLoading={false} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Set up an authenticator app" }));
    await waitFor(() => expect(screen.getByText(errorMessage(new Error("boom")))).toBeTruthy());
    expect(screen.queryByLabelText("Code from the app")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Set up an authenticator app" }).hasAttribute("disabled"),
    ).toBe(false);
  });
});

describe("recovery codes after setup", () => {
  it("lists the codes once and continues", () => {
    const onContinue = vi.fn();
    render(<RecoveryCodesStep codes={["aaaa-bbbb", "cccc-dddd"]} onContinue={onContinue} />);
    expect(screen.getByText("aaaa-bbbb")).toBeTruthy();
    expect(screen.getByText("cccc-dddd")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalled();
  });
});
