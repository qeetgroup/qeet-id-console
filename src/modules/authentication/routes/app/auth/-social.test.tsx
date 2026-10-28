// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError, getApiBaseUrl: () => "https://api.qeet.example" };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
const can = vi.hoisted(() => ({ write: true }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (c?: string) => (c === "connection.write" ? can.write : true),
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/modules/dashboard", async () =>
  (await import("@/modules/authentication/components/methods/__tests__/stubs")).dashboardStub([
    { method: "social", value: 12.88 },
  ]),
);
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("@/modules/authentication/components/methods/__tests__/stubs")).RouterLink,
}));
// Records what each action asks the shared sensitive-action runner for, then runs it for real.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (o: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(o);
        return run(o);
      };
    },
  };
});

import { renderPage } from "@/modules/authentication/components/methods/__tests__/kit";
import { api } from "@/platform/api/client";
import { Route } from "./social";

const SocialPage = Route.options.component as () => React.JSX.Element;
const GOOGLE = {
  id: "sp1",
  tenant_id: "tenant-1",
  provider: "google",
  client_id: "971520692396-aq7y5xpnpnr8ucbdp7kvnehs9hqcinu3.apps.googleusercontent.com",
  discovery_url: "https://accounts.google.com/.well-known/openid-configuration",
  enabled: true,
  created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
};

let calls: { method: string; path: string; body?: unknown }[];

beforeEach(() => {
  calls = [];
  can.write = true;
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    calls.push({ method, path, body: options?.body });
    if (path === "/v1/tenants/tenant-1/social/providers") return { items: [GOOGLE] };
    if (path === "/v1/social/providers" && method === "POST") return { ...GOOGLE };
    if (path.startsWith("/v1/social/providers/")) return { ...GOOGLE, enabled: false };
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

const section = async (name: string) =>
  (await screen.findByRole("heading", { name })).closest("section") as HTMLElement;

describe("Authentication › Social", () => {
  it("lists what's offered first, with its client and when it was added", async () => {
    renderPage(<SocialPage />);
    const offered = await section("Offered at sign-in");
    expect(within(offered).getByText(/13% of sign-ins in the last 30 days/)).toBeTruthy();
    expect(within(offered).getByText("Google")).toBeTruthy();
    expect(within(offered).getByText("971520692396-aq7y5xpnpnr…")).toBeTruthy();
    expect(within(offered).getByText(/added 5 days ago/)).toBeTruthy();
  });

  it("then what can be added, the ones needing a discovery URL folded away", async () => {
    renderPage(<SocialPage />);
    const add = await section("Add a provider");
    expect(within(add).queryByText("Google")).toBeNull();
    expect(within(add).getByText("Apple")).toBeTruthy();
    expect(within(add).queryByText("GitHub")).toBeNull();
    fireEvent.click(within(add).getByRole("button", { name: "5 more that need a discovery URL" }));
    expect(within(add).getByText("GitHub")).toBeTruthy();
    expect(within(add).getByText(/Bitbucket, Spotify,? and Reddit can't be added/)).toBeTruthy();
  });

  it("adds one where its row was: callback URL, then the credentials, behind the step-up", async () => {
    renderPage(<SocialPage />);
    const add = await section("Add a provider");
    fireEvent.click(within(add).getByRole("button", { name: "Add Apple" }));
    expect((within(add).getByLabelText("Callback URL") as HTMLInputElement).value).toBe(
      "https://api.qeet.example/v1/social/apple/callback",
    );
    expect((within(add).getByLabelText("Discovery URL") as HTMLInputElement).value).toBe(
      "https://appleid.apple.com/.well-known/openid-configuration",
    );
    fireEvent.change(within(add).getByLabelText("Client ID"), { target: { value: "in.qeet.web" } });
    fireEvent.change(within(add).getByLabelText("Client secret"), { target: { value: "s3cret" } });
    fireEvent.click(within(add).getByRole("button", { name: "Add Apple" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/v1/social/providers",
        body: {
          tenant_id: "tenant-1",
          provider: "apple",
          client_id: "in.qeet.web",
          client_secret: "s3cret",
          discovery_url: "https://appleid.apple.com/.well-known/openid-configuration",
        },
      }),
    );
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Add Apple" });
  });

  it("asks for the secret of a new provider, but not when changing one", async () => {
    renderPage(<SocialPage />);
    const add = await section("Add a provider");
    fireEvent.click(within(add).getByRole("button", { name: "Add Apple" }));
    fireEvent.change(within(add).getByLabelText("Client ID"), { target: { value: "in.qeet.web" } });
    fireEvent.click(within(add).getByRole("button", { name: "Add Apple" }));
    expect(await within(add).findByText("Enter the client secret.")).toBeTruthy();
    fireEvent.click(within(add).getByRole("button", { name: "Cancel" }));

    const offered = await section("Offered at sign-in");
    fireEvent.click(within(offered).getByRole("button", { name: "Edit Google" }));
    expect(within(offered).getByText("Leave it empty to keep the current secret.")).toBeTruthy();
    fireEvent.click(within(offered).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({ provider: "google", client_secret: "" }),
        }),
      ),
    );
  });

  it("confirms turning one off with what happens to people", async () => {
    renderPage(<SocialPage />);
    const offered = await section("Offered at sign-in");
    fireEvent.click(within(offered).getByRole("button", { name: "Turn off Google" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/anyone with no other way in is locked out/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "PATCH",
        path: "/v1/social/providers/google",
        body: { enabled: false },
      }),
    );
  });

  it("confirms removing one, saying the server refuses while someone has no other way in", async () => {
    renderPage(<SocialPage />);
    const offered = await section("Offered at sign-in");
    fireEvent.click(within(offered).getByRole("button", { name: "Edit Google" }));
    fireEvent.click(within(offered).getByRole("button", { name: "Remove Google" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/refuses while someone can sign in only with google/i),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "DELETE",
        path: "/v1/social/providers/google",
        body: undefined,
      }),
    );
  });

  it("offers no changes to someone who can only read connections", async () => {
    can.write = false;
    renderPage(<SocialPage />);
    await section("Offered at sign-in");
    expect(screen.queryByRole("button", { name: /^(edit|add|turn off)/i })).toBeNull();
  });
});
