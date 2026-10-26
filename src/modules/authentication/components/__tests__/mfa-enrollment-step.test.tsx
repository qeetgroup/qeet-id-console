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

/** Pastes a code into the first of the six slots, as from the app. */
function pasteCode(code: string) {
  const first = screen.getAllByRole("textbox")[0] as HTMLInputElement;
  fireEvent.paste(first, { clipboardData: { getData: () => code } });
}

describe("sign-in authenticator app setup", () => {
  it("sets up the app for the challenge and completes it with a code", async () => {
    const onSubmit = vi.fn();
    render(<MfaEnrollmentStep mfaToken="tok" isLoading={false} onSubmit={onSubmit} />);
    expect(screen.queryByRole("button", { name: /Skip until/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Set up an authenticator app" }));
    // The setup key reads in groups of four, as authenticator apps print it.
    await waitFor(() => expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy());
    expect(startMfaEnrollment).toHaveBeenCalledWith("tok");

    pasteCode("123456");
    const confirm = screen.getByRole("button", { name: "Confirm and sign in" });
    await waitFor(() => expect(confirm.matches(":disabled")).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ code: "123456" }));
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
    expect(screen.getByText(/asks for a second step when you sign in, from/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Skip until/ }));
    expect(onSubmit).toHaveBeenCalledWith({ skip: true });
  });

  it("shows a setup failure and lets the person try again", async () => {
    vi.mocked(startMfaEnrollment).mockRejectedValue(new Error("boom"));
    render(<MfaEnrollmentStep mfaToken="tok" isLoading={false} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Set up an authenticator app" }));
    await waitFor(() => expect(screen.getByText(errorMessage(new Error("boom")))).toBeTruthy());
    expect(screen.queryByText("Code from the app")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Set up an authenticator app" }).matches(":disabled"),
    ).toBe(false);
  });
});

describe("recovery codes after setup", () => {
  it("lists the codes once and continues only once they're saved", () => {
    const onContinue = vi.fn();
    render(<RecoveryCodesStep codes={["aaaa-bbbb", "cccc-dddd"]} onContinue={onContinue} />);
    expect(screen.getByText("aaaa-bbbb")).toBeTruthy();
    expect(screen.getByText("cccc-dddd")).toBeTruthy();
    expect(screen.getByText("2 recovery codes")).toBeTruthy();
    const next = screen.getByRole("button", { name: "Continue to the console" });
    fireEvent.click(next);
    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "I’ve saved these codes somewhere safe" }),
    );
    fireEvent.click(next);
    expect(onContinue).toHaveBeenCalled();
  });
});
