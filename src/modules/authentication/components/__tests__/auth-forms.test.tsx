// @vitest-environment jsdom
import { ThemeProvider } from "@qeetrix/ui";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { TERMS_URL } from "@/platform/config/site-urls";

import { usePlatformSocialProviders } from "../../api/flows";
import { useSSODiscovery } from "../../api/sso";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "../signin-form";
import { SignupForm } from "../signup-form";
import { SocialButtons } from "../social-buttons";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));

vi.mock("../../api/sso", () => ({ useSSODiscovery: vi.fn() }));
vi.mock("../../api/flows", () => ({
  usePlatformSocialProviders: vi.fn(),
  socialStartUrl: (provider: string, intent: string) => `/social/${provider}?intent=${intent}`,
}));

function setProviders(providers: string[]) {
  vi.mocked(usePlatformSocialProviders).mockReturnValue({
    data: { providers },
  } as ReturnType<typeof usePlatformSocialProviders>);
}

function fillIdentity() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " Jane Doe " } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "jane@example.com" } });
}

function submitSignup(submitter: HTMLElement) {
  // fireEvent.submit creates a plain Event and discards submitter in jsdom.
  const event = new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter });
  fireEvent(submitter.closest("form") as HTMLFormElement, event);
}

beforeEach(() => {
  vi.clearAllMocks();
  setProviders(["google", "github"]);
  vi.mocked(useSSODiscovery).mockReturnValue({ data: null } as ReturnType<typeof useSSODiscovery>);
});
afterEach(cleanup);

describe("reference sign-in form", () => {
  it("renders the form, passkey and named provider actions", () => {
    render(<LoginForm onPasskeyLogin={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Sign in to Qeet ID" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot your password?" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
    expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe("username webauthn");
    expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe("current-password");
  });

  it("submits the existing email/password payload", () => {
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(onLogin).toHaveBeenCalledWith({ email: "jane@example.com", password: "test-password" });
  });

  it("starts discoverable passkey sign-in without requiring email or password", () => {
    const onPasskeyLogin = vi.fn();
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} onPasskeyLogin={onPasskeyLogin} />);
    fireEvent.click(screen.getByRole("button", { name: "Use a passkey" }));
    expect(onPasskeyLogin).toHaveBeenCalledOnce();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("retains the password visibility toggle", () => {
    render(<LoginForm />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
  });

  it("preserves the SSO branch rather than offering a password or passkey bypass", () => {
    vi.mocked(useSSODiscovery).mockReturnValue({
      data: { kind: "saml", provider_name: "Team SSO", redirect_url: "https://sso.example.com" },
    } as ReturnType<typeof useSSODiscovery>);
    render(<LoginForm onPasskeyLogin={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue with Team SSO" })).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use a passkey" })).toBeNull();
  });

  it("prevents concurrent password and passkey requests", () => {
    const onLogin = vi.fn();
    render(<LoginForm isPasskeyLoading onLogin={onLogin} onPasskeyLogin={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.matches(":disabled")).toBe(true);
    }
    fireEvent.submit(screen.getByRole("form"));
    expect(onLogin).not.toHaveBeenCalled();
  });
});

describe("reference sign-up form", () => {
  it("submits trimmed identity with the confirmed password", () => {
    const onSignup = vi.fn();
    render(<SignupForm onSignup={onSignup} />);
    fillIdentity();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "test-password" },
    });
    submitSignup(screen.getByRole("button", { name: "Create account" }));
    expect(onSignup).toHaveBeenCalledWith({
      email: "jane@example.com",
      display_name: "Jane Doe",
      password: "test-password",
    });
  });

  it("shows an associated mismatch error, focuses the field, and clears it on edit", () => {
    const onSignup = vi.fn();
    render(<SignupForm onSignup={onSignup} />);
    fillIdentity();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    const confirm = screen.getByLabelText("Confirm password");
    fireEvent.change(confirm, { target: { value: "other-password" } });
    submitSignup(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert").textContent).toContain("Passwords don’t match.");
    expect(confirm.getAttribute("aria-describedby")).toBe("password-mismatch");
    expect(document.activeElement).toBe(confirm);
    expect(onSignup).not.toHaveBeenCalled();
    fireEvent.change(confirm, { target: { value: "test-password" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("submits only name and email for passkey signup, without a password", () => {
    const onPasskeySignup = vi.fn();
    const onSignup = vi.fn();
    render(<SignupForm onSignup={onSignup} onPasskeySignup={onPasskeySignup} />);
    fillIdentity();
    const button = screen.getByRole("button", { name: "Use a passkey" }) as HTMLButtonElement;
    expect(button.formNoValidate).toBe(true);
    submitSignup(button);
    expect(onPasskeySignup).toHaveBeenCalledWith({
      email: "jane@example.com",
      display_name: "Jane Doe",
    });
    expect(onSignup).not.toHaveBeenCalled();
  });

  it("still validates name and email before a passkey ceremony", () => {
    const onPasskeySignup = vi.fn();
    render(<SignupForm onPasskeySignup={onPasskeySignup} />);
    const button = screen.getByRole("button", { name: "Use a passkey" });
    submitSignup(button);
    expect(onPasskeySignup).not.toHaveBeenCalled();
    fillIdentity();
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "not-an-email" } });
    submitSignup(button);
    expect(onPasskeySignup).not.toHaveBeenCalled();
  });

  it("associates strength feedback with the password only when it exists", () => {
    render(<SignupForm />);
    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("aria-describedby")).toBeNull();
    fireEvent.change(input, { target: { value: "short" } });
    expect(input.getAttribute("aria-describedby")).toBe("password-strength");
    expect(document.getElementById("password-strength")).toBeTruthy();
  });
});

describe("shared authentication chrome", () => {
  it("retains the sign-in and sign-up consent copy with real legal links", () => {
    // The shell's theme toggle needs the provider __root.tsx supplies in-app.
    const shell = (intent: "signin" | "signup") => (
      <ThemeProvider storageKey="test-theme">
        <AuthShell intent={intent}>Form</AuthShell>
      </ThemeProvider>
    );
    const { rerender } = render(shell("signin"));
    expect(screen.getByText(/By signing in/)).toBeTruthy();
    rerender(shell("signup"));
    expect(screen.getByText(/By signing up/)).toBeTruthy();
    const legal = within(screen.getByRole("navigation", { name: "Legal and trust" }));
    expect(legal.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe(
      TERMS_URL,
    );
    expect(screen.getByRole("main").id).toBe("auth-content");
  });

  it("shows only configured social providers and no fake provider placeholders", () => {
    setProviders(["github"]);
    const { rerender } = render(<SocialButtons />);
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
    setProviders([]);
    rerender(<SocialButtons />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Or continue with")).toBeNull();
  });
});
