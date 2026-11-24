// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { cleanup, fireEvent, render as renderUI, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { type MfaChallenge, useCompleteMfaLogin } from "@/modules/authentication/api/flows";
import {
  awaitPushApproval,
  mfaPasskeyProof,
  sendMfaCode,
  sendPushRequest,
} from "@/modules/authentication/api/mfa-sign-in";
import { ApiError } from "@/platform/errors/api-error";
import { MfaChallengeStep } from "../mfa-challenge-step";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("@/modules/authentication/api/flows", () => ({ useCompleteMfaLogin: vi.fn() }));
vi.mock("@/modules/authentication/api/mfa-sign-in", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/authentication/api/mfa-sign-in")>()),
  awaitPushApproval: vi.fn(),
  mfaPasskeyProof: vi.fn(),
  sendMfaCode: vi.fn(),
  sendPushRequest: vi.fn(),
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
    methods: factors.map((f) => f.type) as MfaChallenge["methods"],
    factors: factors as never,
  };
}

/** A push request the server sent: its number, ending this many seconds from now. */
function pushRequest(number: number, seconds = 110) {
  return { number, expires_at: new Date(Date.now() + seconds * 1000).toISOString() };
}

/** Opens Approve on your phone from the other ways to confirm. */
function approveOnPhone() {
  fireEvent.click(screen.getByRole("button", { name: /Approve on your phone/ }));
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

  it("shows the number for the phone as soon as the request is sent, then signs in on approval", async () => {
    vi.mocked(sendPushRequest).mockResolvedValue(pushRequest(47));
    let approve!: (approved: boolean) => void;
    vi.mocked(awaitPushApproval).mockReturnValue(new Promise((resolve) => (approve = resolve)));
    render(<MfaChallengeStep challenge={challenge([{ type: "push" }])} />);
    approveOnPhone();

    const number = await screen.findByRole("img", { name: "Number to type: 47" });
    expect(number.textContent).toContain("47");
    expect(screen.getByText(/^Waiting for your phone · ends in 1:(4\d|50)$/)).toBeTruthy();
    expect(sendPushRequest).toHaveBeenCalledWith("tok");
    expect(navigate).not.toHaveBeenCalled();

    approve(true);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });

  it("says when the request ended unanswered, and sends a new one", async () => {
    vi.mocked(sendPushRequest)
      .mockResolvedValueOnce(pushRequest(47))
      .mockResolvedValueOnce(pushRequest(82));
    vi.mocked(awaitPushApproval)
      .mockRejectedValueOnce(new ApiError(410, "mfa.push_challenge_expired", ""))
      .mockReturnValueOnce(new Promise(() => {}));
    render(<MfaChallengeStep challenge={challenge([{ type: "push" }])} />);
    approveOnPhone();

    await screen.findByRole("heading", { level: 1, name: "The request ended" });
    expect(screen.getByText(/didn’t answer in time/)).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Number to type/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Send a new request" }));
    await screen.findByRole("img", { name: "Number to type: 82" });
    expect(sendPushRequest).toHaveBeenCalledTimes(2);
  });

  it("says when the request was denied on the phone", async () => {
    vi.mocked(sendPushRequest).mockResolvedValue(pushRequest(47));
    vi.mocked(awaitPushApproval).mockRejectedValue(new ApiError(401, "mfa.code_invalid", ""));
    render(<MfaChallengeStep challenge={challenge([{ type: "push" }])} />);
    approveOnPhone();

    await screen.findByRole("heading", { level: 1, name: "You denied this sign-in" });
    expect(screen.getByRole("button", { name: "Send a new request" })).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("explains a request that couldn't be sent in its own words, never the server's", async () => {
    vi.mocked(sendPushRequest).mockRejectedValue(
      new ApiError(429, "mfa.push_limited", "internal detail"),
    );
    render(<MfaChallengeStep challenge={challenge([{ type: "push" }])} />);
    approveOnPhone();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Too many requests were sent to your phone.");
    expect(alert.textContent).not.toContain("internal detail");
    expect(awaitPushApproval).not.toHaveBeenCalled();
  });

  it("stops waiting for the phone on Try another way", async () => {
    vi.mocked(sendPushRequest).mockResolvedValue(pushRequest(47));
    let signal: AbortSignal | undefined;
    vi.mocked(awaitPushApproval).mockImplementation((_token, s) => {
      signal = s;
      return new Promise(() => {});
    });
    render(<MfaChallengeStep challenge={challenge([{ type: "push" }])} />);
    approveOnPhone();
    await screen.findByRole("img", { name: "Number to type: 47" });

    fireEvent.click(screen.getByRole("button", { name: "Try another way" }));
    await screen.findByRole("button", { name: /Approve on your phone/ });
    expect(signal?.aborted).toBe(true);
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
