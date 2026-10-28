// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { ApiError } from "@/platform/errors/api-error";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: vi.fn(),
}));

// The person holds an authenticator app and one email factor; verifying answers as `verify` says.
let verify: (path: string, code: string) => unknown = () => ({ verified: true });
const calls: { path: string; body?: unknown }[] = [];
vi.mock("@/platform/api/client", () => ({
  api: vi.fn(async (path: string, init?: { body?: { code?: string } }) => {
    calls.push({ path, body: init?.body });
    if (path === "/v1/mfa/totp") return { enrolled: true };
    if (path === "/v1/mfa/otp/factors") {
      return {
        items: [{ id: "f1", channel: "email", destination: "j***@example.com", verified: true }],
      };
    }
    if (path.endsWith("/verify")) return verify(path, init?.body?.code ?? "");
    if (path.endsWith("/challenge")) return { message: "sent" };
    return { items: [] };
  }),
}));

import { StepUpDialog } from "../step-up-dialog";

function mount(onVerified = vi.fn(), allowedMethods: string[] | null = null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <StepUpDialog
        open
        onOpenChange={vi.fn()}
        onVerified={onVerified}
        actionLabel="Delete user"
        allowedMethods={allowedMethods}
      />
    </QueryClientProvider>,
  );
  return onVerified;
}

/** Pastes a code into the first of the six slots, as from the app. */
function pasteCode(code: string) {
  const first = screen.getAllByRole("textbox")[0] as HTMLInputElement;
  fireEvent.paste(first, { clipboardData: { getData: () => code } });
}

beforeEach(() => {
  calls.length = 0;
  verify = () => ({ verified: true });
});
afterEach(cleanup);

describe("StepUpDialog", () => {
  it("takes the authenticator code in six slots, three and three, and confirms once filled", async () => {
    const onVerified = mount();
    const group = await screen.findByRole("group", { name: "Code from your authenticator app" });
    expect(group.querySelectorAll("input")).toHaveLength(6);

    pasteCode("123456");

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(calls).toContainEqual({ path: "/v1/mfa/totp/verify", body: { code: "123456" } });
  });

  it("shows a refused code as the field's error and empties the slots", async () => {
    verify = () => {
      throw new ApiError(400, "mfa_invalid_code", "bad code");
    };
    const onVerified = mount();
    await screen.findByRole("group", { name: "Code from your authenticator app" });

    pasteCode("123456");

    await waitFor(() =>
      expect(
        screen.getAllByRole("textbox").every((s) => (s as HTMLInputElement).value === ""),
      ).toBe(true),
    );
    expect(screen.getAllByRole("textbox")[0]?.getAttribute("aria-invalid")).toBe("true");
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("swaps the slots for a recovery code, and back", async () => {
    const onVerified = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Use a recovery code instead" }));

    const field = screen.getByRole("textbox", { name: "Recovery code" });
    expect(field.getAttribute("inputmode")).toBeNull(); // letters and digits, e.g. 7KQ2-M9XD
    const confirm = screen.getByRole("button", { name: "Verify" });
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(field, { target: { value: "7KQ2-M9XD" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(calls).toContainEqual({ path: "/v1/mfa/totp/verify", body: { code: "7KQ2-M9XD" } });
  });

  it("sends a code to an email factor and checks it as that factor's code", async () => {
    const onVerified = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Send a code to j***@example.com" }));

    await screen.findByRole("group", { name: "Code sent to j***@example.com" });
    expect(calls.map((c) => c.path)).toContain("/v1/mfa/otp/factors/f1/challenge");
    pasteCode("654321");
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(calls).toContainEqual({ path: "/v1/mfa/otp/verify", body: { code: "654321" } });
  });

  it("sends someone with no factor the organisation counts to account security", async () => {
    mount(vi.fn(), ["webauthn"]); // only passkeys count, and this person has none
    const link = await screen.findByRole("link", { name: "account security" });
    expect(link.getAttribute("href")).toBe("/account/security");
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
  });
});
