// @vitest-environment jsdom
import { QeetrixProvider } from "@qeetrix/react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { TERMS_URL } from "@/platform/config/site-urls";

import { usePlatformSocialProviders } from "@/modules/authentication/api/flows";
import { useSSODiscovery } from "@/modules/authentication/api/sso";
import { EntryConsent, EntryShell } from "../entry-shell";
import { ProviderButtons } from "../provider-buttons";
import { LoginForm } from "../signin-form";
import { SignupForm } from "../signup-form";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));

vi.mock("@/modules/authentication/api/sso", () => ({ useSSODiscovery: vi.fn() }));
vi.mock("@/modules/authentication/api/flows", () => ({
  usePlatformSocialProviders: vi.fn(),
  socialStartUrl: (provider: string, intent: string) => `/social/${provider}?intent=${intent}`,
}));

function setProviders(providers: string[]) {
  vi.mocked(usePlatformSocialProviders).mockReturnValue({
    data: { providers },
    isPending: false,
  } as unknown as ReturnType<typeof usePlatformSocialProviders>);
}

function noSso() {
  vi.mocked(useSSODiscovery).mockReturnValue({
    data: null,
    isFetching: false,
  } as unknown as ReturnType<typeof useSSODiscovery>);
}

/** Enters the work email and continues to the password step. */
async function continueWithEmail(email = "jane@example.com") {
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Welcome back" });
}

beforeEach(() => {
  vi.clearAllMocks();
  setProviders(["github"]);
  noSso();
});
afterEach(cleanup);

describe("sign-in, email first", () => {
  it("offers the email, a passkey and the providers, with the autofill hint on the email", () => {
    render(<LoginForm onPasskeyLogin={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Sign in to Qeet ID" })).toBeTruthy();
    expect(screen.getByLabelText("Work email").getAttribute("autocomplete")).toBe(
      "username webauthn",
    );
    expect(screen.getByRole("button", { name: "Sign in with a passkey" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create an organisation" }).getAttribute("href")).toBe(
      "/sign-up",
    );
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("continues to the password step and submits the existing email/password payload", async () => {
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    await continueWithEmail();
    expect(screen.getByText("jane@example.com")).toBeTruthy();
    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
    fireEvent.change(password, { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(onLogin).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "test-password",
      }),
    );
  });

  it("goes back to the email step to change the address", async () => {
    render(<LoginForm />);
    await continueWithEmail();
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByRole("heading", { name: "Sign in to Qeet ID" })).toBeTruthy();
  });

  it("starts discoverable passkey sign-in without requiring an email or password", () => {
    const onPasskeyLogin = vi.fn();
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} onPasskeyLogin={onPasskeyLogin} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with a passkey" }));
    expect(onPasskeyLogin).toHaveBeenCalledOnce();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("retains the password visibility toggle", async () => {
    render(<LoginForm />);
    await continueWithEmail();
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
  });

  it("preserves the SSO branch rather than offering a password, passkey or social bypass", () => {
    vi.mocked(useSSODiscovery).mockReturnValue({
      data: { kind: "saml", provider_name: "Team SSO", redirect_url: "https://sso.example.com" },
      isFetching: false,
    } as unknown as ReturnType<typeof useSSODiscovery>);
    render(<LoginForm onPasskeyLogin={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue with Team SSO" })).toBeTruthy();
    expect(screen.getByText("Your organisation signs in with Team SSO")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in with a passkey" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Other ways to sign in" })).toBeNull(); // the fieldset
  });

  it("prevents concurrent password and passkey requests", () => {
    const onLogin = vi.fn();
    render(<LoginForm isPasskeyLoading onLogin={onLogin} onPasskeyLogin={vi.fn()} />);
    // A submit button stays focusable while disabled (aria-disabled), so focus isn't lost.
    for (const button of screen.getAllByRole("button")) {
      expect(button.matches(":disabled") || button.getAttribute("aria-disabled") === "true").toBe(
        true,
      );
    }
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("confirms a password reset on arrival", () => {
    render(<LoginForm resetDone />);
    expect(screen.getByText("Your password is updated")).toBeTruthy();
  });

  it("shows a failed sign-in as an alert", () => {
    render(<LoginForm errorMessage="That email and password don’t match." />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("We couldn’t sign you in");
    expect(alert.textContent).toContain("That email and password don’t match.");
  });
});

describe("sign-up, passkey first", () => {
  function fillIdentity(email = "jane@example.com") {
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " Jane Doe " } });
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: email } });
  }

  it("creates the account with a passkey from the trimmed name and email, without a password", async () => {
    const onPasskeySignup = vi.fn();
    const onSignup = vi.fn();
    render(<SignupForm onSignup={onSignup} onPasskeySignup={onPasskeySignup} />);
    expect(screen.queryByLabelText("Password")).toBeNull();
    fillIdentity();
    fireEvent.click(screen.getByRole("button", { name: "Create account with a passkey" }));
    await waitFor(() =>
      expect(onPasskeySignup).toHaveBeenCalledWith({
        email: "jane@example.com",
        display_name: "Jane Doe",
      }),
    );
    expect(onSignup).not.toHaveBeenCalled();
  });

  it("still validates the name and email before a passkey ceremony", async () => {
    const onPasskeySignup = vi.fn();
    render(<SignupForm onPasskeySignup={onPasskeySignup} />);
    const submit = screen.getByRole("button", { name: "Create account with a passkey" });
    fireEvent.click(submit);
    fillIdentity("not-an-email");
    fireEvent.click(submit);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onPasskeySignup).not.toHaveBeenCalled();
  });

  it("switches to a password, with no confirm field, and submits it", async () => {
    const onSignup = vi.fn();
    render(<SignupForm onSignup={onSignup} onPasskeySignup={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Use a password instead" }));
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
    fillIdentity();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(onSignup).toHaveBeenCalledWith({
        email: "jane@example.com",
        display_name: "Jane Doe",
        password: "test-password",
      }),
    );
  });

  it("offers sign-in when the email already has an account", () => {
    render(<SignupForm existingEmail="jane@example.com" />);
    expect(screen.getByText("jane@example.com already has an account")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in instead" }).getAttribute("href")).toBe(
      "/sign-in",
    );
    expect(screen.getByLabelText("Work email").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("entry chrome", () => {
  it("keeps the legal links, the consent copy and the skip target", () => {
    render(
      <QeetrixProvider defaultColorScheme="light">
        <EntryShell panel={null}>
          <EntryConsent action="signUp" />
        </EntryShell>
      </QeetrixProvider>,
    );
    expect(screen.getByText(/By creating an account/)).toBeTruthy();
    const legal = within(screen.getByRole("navigation", { name: "Legal and trust" }));
    expect(legal.getByRole("link", { name: /Terms/ }).getAttribute("href")).toBe(TERMS_URL);
    expect(screen.getByRole("main").id).toBe("entry-content");
  });

  it("always shows Google, Microsoft and Apple, and GitHub once configured", () => {
    setProviders([]);
    const { rerender } = render(<ProviderButtons action="signIn" />);
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Microsoft" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Apple" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in with GitHub" })).toBeNull();
    setProviders(["github"]);
    rerender(<ProviderButtons action="signIn" />);
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeTruthy();
  });

  it("explains a provider that isn't configured instead of opening a broken page", () => {
    setProviders([]);
    render(<ProviderButtons action="signUp" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));
    expect(screen.getByText("Google sign-in isn’t available yet")).toBeTruthy();
  });
});
