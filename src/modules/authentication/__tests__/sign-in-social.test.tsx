// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const state = vi.hoisted(() => ({
  social: { data: undefined as unknown, isError: false, error: null, mutate: vi.fn() },
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: state.toastError, success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/modules/authentication", () => ({
  isMfaChallenge: (r: { mfa_required?: boolean }) => r.mfa_required === true,
  useConsumeSocialCode: () => state.social,
  useLogin: () => ({
    data: undefined,
    isPending: false,
    error: null,
    mutate: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("../api/passkey-flows", () => ({
  passkeyErrorMessage: () => "",
  startPasskeyAutofill: () => () => {},
  usePasskeyLogin: () => ({ isPending: false, error: null, mutate: vi.fn(), reset: vi.fn() }),
}));
vi.mock("../components/entry-panel", () => ({
  EntryPanel: () => null,
  useEntrySteps: () => ({ signIn: [] }),
}));
vi.mock("../components/entry-shell", () => ({
  EntryShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/lazy-mfa-challenge-step", () => ({
  LazyMfaChallengeStep: ({ challenge }: { challenge: { mfa_token: string } }) => (
    <p>Second factor for {challenge.mfa_token}</p>
  ),
  preloadMfaChallengeStep: vi.fn(),
}));
vi.mock("../components/signin-form", () => ({ LoginForm: () => <p>Sign-in form</p> }));

import { SignInPage } from "../components/sign-in-page";

const show = () =>
  render(
    <QeetrixProvider>
      <SignInPage />
    </QeetrixProvider>,
  );

beforeEach(() => {
  state.social = { data: undefined, isError: false, error: null, mutate: vi.fn() };
  state.toastError.mockReset();
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/sign-in");
});

describe("Social sign-in", () => {
  it("shows the second-factor step when the account needs one", () => {
    window.history.replaceState({}, "", "/sign-in?social_code=one-time");
    state.social.data = { mfa_required: true, mfa_token: "mfa-1", methods: ["totp"] };
    show();
    expect(screen.getByText("Second factor for mfa-1")).toBeTruthy();
    expect(screen.queryByText("Sign-in form")).toBeNull();
  });

  it.each([
    ["no_account", "No account uses that provider yet. Sign up first, then sign in."],
    [
      "account_unverified",
      "An account already uses this email address, but it hasn’t been verified.",
    ],
    ["account_inactive", "Your account isn’t active. Contact your administrator."],
    ["other_browser", "That sign-in started in a different browser. Start it again here."],
  ])("says why it was refused (%s), once", (reason, message) => {
    window.history.replaceState({}, "", `/sign-in?social_error=${reason}`);
    show();
    expect(state.toastError).toHaveBeenCalledOnce();
    expect(state.toastError).toHaveBeenCalledWith(expect.stringContaining(message));
    expect(window.location.search).toBe("");
  });

  it("says nothing for a reason it doesn't know", () => {
    window.history.replaceState({}, "", "/sign-in?social_error=toString");
    show();
    expect(state.toastError).not.toHaveBeenCalled();
  });
});
