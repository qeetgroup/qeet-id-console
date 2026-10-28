// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/modules/dashboard", async () =>
  (await import("@/modules/authentication/components/methods/__tests__/stubs")).dashboardStub(),
);
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("@/modules/authentication/components/methods/__tests__/stubs")).RouterLink,
}));

import { renderPage } from "@/modules/authentication/components/methods/__tests__/kit";
import { api } from "@/platform/api/client";
import { Route } from "./totp";

const TotpPage = Route.options.component as () => React.JSX.Element;
const CODES = ["aaaa-1111", "bbbb-2222", "cccc-3333"];

let enrolled: boolean;
let recovery: { enrolled: boolean; total: number; remaining: number };
let confirmed: unknown;
let disabled: boolean;

beforeEach(() => {
  enrolled = false;
  recovery = { enrolled: false, total: 0, remaining: 0 };
  confirmed = undefined;
  disabled = false;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/mfa/totp" && method === "GET") return { enrolled };
    if (path === "/v1/mfa/totp" && method === "DELETE") {
      disabled = true;
      return undefined;
    }
    if (path === "/v1/mfa/recovery-codes") return recovery;
    if (path === "/v1/mfa/totp/enroll/start")
      return {
        secret: "JBSWY3DPEHPK3PXP",
        provisioning_url: "otpauth://totp/Qeet:ada?secret=JBSWY3DPEHPK3PXP",
        replacing: false,
      };
    if (path === "/v1/mfa/totp/enroll/confirm") {
      confirmed = options?.body;
      return { recovery_codes: CODES };
    }
    if (path === "/v1/mfa/recovery-codes/regenerate") return { recovery_codes: CODES };
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

describe("MFA › TOTP (your own)", () => {
  it("sets the app up under its row, then shows the recovery codes once", async () => {
    renderPage(<TotpPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up" }));
    expect(await screen.findByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy();
    const first = screen.getAllByRole("textbox", { name: /code from the app/i })[0] as HTMLElement;
    fireEvent.paste(first, { clipboardData: { getData: () => "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(confirmed).toEqual({ code: "123456" }));
    expect(await screen.findByText("aaaa-1111")).toBeTruthy();
    const done = screen.getByRole("button", { name: "Done" });
    expect(done.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("checkbox", { name: /i've saved these codes/i }));
    expect(done.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("asks for the whole code before confirming", async () => {
    renderPage(<TotpPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up" }));
    await screen.findByText("JBSW Y3DP EHPK 3PXP");
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(await screen.findByText("Enter the 6-digit code from the app.")).toBeTruthy();
    expect(confirmed).toBeUndefined();
  });

  it("confirms turning a set-up app off with what happens to the codes", async () => {
    enrolled = true;
    recovery = { enrolled: true, total: 10, remaining: 2 };
    renderPage(<TotpPage />);
    const codes = (await screen.findByRole("heading", { name: "Your recovery codes" })).closest(
      "section",
    ) as HTMLElement;
    expect(within(codes).getByText("2 of 10 left")).toBeTruthy();
    expect(within(codes).getByText("Running low")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/so do your recovery codes/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(disabled).toBe(true));
  });

  it("confirms new recovery codes, since they void the old ones", async () => {
    enrolled = true;
    recovery = { enrolled: true, total: 10, remaining: 8 };
    renderPage(<TotpPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Get new codes" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/the codes you have now stop working/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Get new codes" }));
    expect(await screen.findByText("cccc-3333")).toBeTruthy();
  });
});
