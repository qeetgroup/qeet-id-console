// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { cleanup, fireEvent, render as renderUI, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { useCompleteMfaLogin } from "@/modules/authentication/api/flows";
import {
  completeWithPush,
  mfaPasskeyProof,
  sendMfaCode,
} from "@/modules/authentication/api/mfa-sign-in";
import { MfaChallengeStep } from "../mfa-challenge-step";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("@/modules/authentication/api/flows", () => ({ useCompleteMfaLogin: vi.fn() }));
vi.mock("@/modules/authentication/api/mfa-sign-in", () => ({
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

// The entry frame's theme menu needs the provider __root.tsx supplies in-app.
function render(node: ReactNode) {
  return renderUI(node, {
    wrapper: ({ children }) => (
      <QeetrixProvider defaultColorScheme="light">{children}</QeetrixProvider>
    ),
  });
}

function challenge(factors: { type: string; id?: string; destination?: string }[]) {
  return {
    mfa_required: true as const,
    mfa_token: "tok",
    methods: factors.map((f) => f.type),
    factors: factors as never,
  };
}

/** Pastes a code into the first of the six slots, as from the app. */
function pasteCode(code: string) {
  const first = screen.getAllByRole("textbox")[0] as HTMLInputElement;
  fireEvent.paste(first, { clipboardData: { getData: () => code } });
}

beforeEach(() => {
  vi.clearAllMocks();
  completion();
});
afterEach(cleanup);

describe("a sign-in's second-factor challenge", () => {
  it("asks for the authenticator code and completes the challenge with it", async () => {
    render(<MfaChallengeStep challenge={challenge([{ type: "totp" }])} />);
    expect(screen.getByRole("heading", { level: 1, name: "Confirm it’s you" })).toBeTruthy();
    pasteCode("123456");
    const verify = screen.getByRole("button", { name: "Verify" });
    await waitFor(() => expect(verify.matches(":disabled")).toBe(false));
    fireEvent.click(verify);
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ mfa_token: "tok", code: "123456" }));
  });

  it("takes a recovery code in place of the app's", async () => {
    render(
      <MfaChallengeStep challenge={challenge([{ type: "totp" }, { type: "recovery_code" }])} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Use a recovery code instead" }));
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: " 7KQ2-M9XD " } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ mfa_token: "tok", code: "7KQ2-M9XD" }),
    );
  });

  it("sends a code to an email factor and says where it went", async () => {
    vi.mocked(sendMfaCode).mockResolvedValue(undefined as never);
    render(
      <MfaChallengeStep
        challenge={challenge([{ type: "email", id: "f1", destination: "p•••@acme.in" }])}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Email a code/ }));
    await screen.findByText("Code sent to p•••@acme.in");
    expect(sendMfaCode).toHaveBeenCalledWith("tok", "f1");
  });

  it("completes the challenge with a passkey", async () => {
    const proof = { passkey: { session_id: "s", credential: {} } };
    vi.mocked(mfaPasskeyProof).mockResolvedValue(proof as never);
    render(<MfaChallengeStep challenge={challenge([{ type: "passkey" }])} />);
    fireEvent.click(screen.getByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ mfa_token: "tok", ...proof }));
  });

  it("waits for a phone approval, and stops waiting on Cancel", async () => {
    vi.mocked(completeWithPush).mockImplementation(
      (_token: string, signal?: AbortSignal) =>
        new Promise((_, reject) =>
          signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          ),
        ),
    );
    render(<MfaChallengeStep challenge={challenge([{ type: "push" }])} />);
    fireEvent.click(screen.getByRole("button", { name: /Approve on your phone/ }));
    await screen.findByText("Approve the sign-in on your phone");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("button", { name: /Approve on your phone/ });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sets up an authenticator app when the account must have one", () => {
    render(
      <MfaChallengeStep challenge={{ ...challenge([]), factors: [], enrollment_required: true }} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Set up two‑step verification" }),
    ).toBeTruthy();
  });

  it("shows the recovery codes the setup minted, then opens the console once they're saved", () => {
    completion({ recovery_codes: ["aaaa-bbbb"] });
    render(<MfaChallengeStep challenge={{ ...challenge([]), enrollment_required: true }} />);
    expect(screen.getByText("aaaa-bbbb")).toBeTruthy();
    const next = screen.getByRole("button", { name: "Continue to the console" });
    fireEvent.click(next);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "I’ve saved these codes somewhere safe" }),
    );
    fireEvent.click(next);
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
