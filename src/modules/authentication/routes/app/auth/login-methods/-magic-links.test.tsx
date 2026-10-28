// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
const can = vi.hoisted(() => ({ emails: true }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (c?: string) => (c === "branding.write" ? can.emails : true),
  }),
}));
vi.mock("@/modules/dashboard", async () =>
  (await import("@/modules/authentication/components/methods/__tests__/stubs")).dashboardStub([
    { method: "magic_link", value: 9.68 },
  ]),
);
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("@/modules/authentication/components/methods/__tests__/stubs")).RouterLink,
}));

import { renderPage } from "@/modules/authentication/components/methods/__tests__/kit";
import { api } from "@/platform/api/client";
import { Route } from "./magic-links";

const MagicLinksPage = Route.options.component as () => React.JSX.Element;
const POLICY_PATH = "/v1/tenants/tenant-1/auth-policy";

let ttl: number;
let saved: Record<string, unknown> | undefined;

beforeEach(() => {
  ttl = 30;
  saved = undefined;
  can.emails = true;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const policy = {
      password_enabled: true,
      passkey_enabled: true,
      magic_link_enabled: true,
      magic_link_ttl_minutes: ttl,
      remember_device_days: 30,
    };
    if (path === POLICY_PATH && (options?.method ?? "GET") === "GET") return policy;
    if (path === POLICY_PATH && options?.method === "PUT") {
      saved = options.body as Record<string, unknown>;
      return { ...policy, ...saved };
    }
    if (path === "/v1/tenants/tenant-1/email-templates")
      return { items: [{ key: "magic_link", name: "Magic link", custom: false }] };
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

const section = async (name: string) =>
  (await screen.findByRole("heading", { name })).closest("section") as HTMLElement;

describe("Sign-in › Magic links", () => {
  it("owns the magic-link switch, with its use", async () => {
    renderPage(<MagicLinksPage />);
    const magic = await section("Magic links");
    expect(within(magic).getByText(/used for 10% of sign-ins/i)).toBeTruthy();
    fireEvent.click(within(magic).getByRole("button", { name: "Turn off Magic links" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/links already sent stop working/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(saved).toMatchObject({ magic_link_enabled: false }));
  });

  it("changes how long a link works, marking the current one", async () => {
    renderPage(<MagicLinksPage />);
    const link = await section("The link and its email");
    expect(within(link).getByText("30 minutes")).toBeTruthy();
    fireEvent.click(within(link).getByRole("button", { name: "Edit how long a link works" }));
    expect(within(link).getByText("Current")).toBeTruthy();
    fireEvent.click(within(link).getByRole("radio", { name: /15 minutes/ }));
    fireEvent.click(within(link).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toMatchObject({ magic_link_ttl_minutes: 15 }));
  });

  it("offers a lifetime set elsewhere as the current one, in hours", async () => {
    ttl = 240;
    renderPage(<MagicLinksPage />);
    const link = await section("The link and its email");
    expect(within(link).getByText("4 hours")).toBeTruthy();
    fireEvent.click(within(link).getByRole("button", { name: "Edit how long a link works" }));
    expect(within(link).getByRole("radio", { name: /4 hours/ })).toBeTruthy();
  });

  it("names the email it's sent in and links to where it's edited", async () => {
    renderPage(<MagicLinksPage />);
    const link = await section("The link and its email");
    expect(await within(link).findByText(/Qeet ID's standard wording/)).toBeTruthy();
    expect(within(link).getByRole("link", { name: "Edit email" }).getAttribute("href")).toBe(
      "/settings/organization/email-templates",
    );
  });

  it("only names the email for someone who can't edit emails", async () => {
    can.emails = false;
    renderPage(<MagicLinksPage />);
    const link = await section("The link and its email");
    expect(within(link).getByText("Magic link")).toBeTruthy();
    expect(within(link).queryByRole("link", { name: "Edit email" })).toBeNull();
  });
});
