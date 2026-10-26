// @vitest-environment jsdom
import { ThemeProvider } from "@qeetrix/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderUI,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({
  userId: "user-a" as string | null,
  tenantId: "11111111-1111-4111-8111-111111111111",
  navigate: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => context.navigate }));
vi.mock("@/platform/auth/session", () => ({
  useUserId: () => context.userId,
  useTenantId: () => context.tenantId,
  useMe: () => ({
    data: { id: "user-a", email: "operator@example.test", display_name: "Mina Shah" },
    isError: false,
  }),
  useLogout: () => ({ mutate: context.logout }),
  useIdleLogout: vi.fn(),
}));
vi.mock("../api/flows", () => ({ switchToTenant: vi.fn().mockResolvedValue(undefined) }));
// Invitations waiting for this email: none, unless a test adds some.
const invites = vi.hoisted(() => ({
  items: [] as { id: string; tenant_name: string; email: string; expires_at: string }[],
  accept: vi.fn(),
  decline: vi.fn(),
}));
vi.mock("../api/flows-invitations", () => ({
  useMyInvitations: () => ({ data: { items: invites.items }, isPending: false }),
  useAcceptInvitation: () => ({ mutate: invites.accept }),
  useDeclineInvitation: () => ({ mutate: invites.decline }),
}));

import { api } from "@/platform/api/client";
import type { EligibleOrganization } from "@/platform/auth/organization-selection";
import { switchToTenant } from "../api/flows";
import { loadEligibleOrganizations } from "../api/organization-selection";
import {
  OrganizationSelectionPage,
  OrganizationSelectorView,
  type OrganizationSelectorViewProps,
} from "../components/organization-selector";
import {
  filterOrganizations,
  mostRecentOrganization,
  organizationImage,
} from "../organization-selection-model";

function fixture(index: number): EligibleOrganization {
  const organization = fixtures()[index];
  assert(organization, `no organization fixture at ${index}`);
  return organization;
}

function fixtures(): EligibleOrganization[] {
  return [
    {
      name: "Acme Technologies",
      slug: "acme",
      domain: "acme.example",
      roles: ["owner"],
      plan: "enterprise",
      region: "us-east-1",
    },
    {
      name: "Globalsphere",
      slug: "globalsphere",
      domain: "global.example",
      roles: ["admin"],
      plan: "pro",
      region: "eu-west-1",
    },
    {
      name: "GreenField Labs",
      slug: "greenfield",
      domain: "greenfield.example",
      roles: ["member"],
      plan: "starter",
      region: "us-west-2",
    },
    {
      name: "Nova Systems",
      slug: "nova",
      domain: "",
      roles: ["admin"],
      plan: "pro",
      region: "ap-south-1",
    },
    {
      name: "Quantum Works",
      slug: "quantum",
      domain: "quantum.example",
      roles: ["member", "Billing manager"],
      plan: "pro",
      region: "us-east-1",
    },
  ].map((organization, index) => ({
    ...organization,
    id: `${String(index + 1).repeat(8)}-1111-4111-8111-111111111111`,
    logo_url: "",
    last_used_at: index === 0 ? "2026-09-12T12:00:00Z" : null,
  }));
}

function viewProps(): OrganizationSelectorViewProps {
  return {
    organizations: fixtures(),
    user: { id: "user-a", email: "operator@example.test", display_name: "Mina Shah" },
    loading: false,
    error: false,
    fetching: false,
    onRetry: vi.fn(),
    onContinue: vi.fn().mockResolvedValue(undefined),
    onCreate: vi.fn(),
    onAccount: vi.fn(),
    onSignOut: vi.fn(),
  };
}

function render(node: ReactNode) {
  const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  return renderUI(node, {
    wrapper: ({ children }) => (
      <ThemeProvider defaultTheme={theme} storageKey="organization-selector-test">
        {children}
      </ThemeProvider>
    ),
  });
}

function renderPage(onCreate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <OrganizationSelectionPage onCreate={onCreate} />
      </QueryClientProvider>,
    ),
    client,
  };
}

const invitation = (id: string, tenant_name: string) => ({
  id,
  tenant_name,
  email: "operator@example.test",
  expires_at: new Date(Date.now() + 6 * 86_400_000).toISOString(),
});

beforeEach(() => {
  context.userId = "user-a";
  context.tenantId = fixture(0).id;
  context.navigate.mockReset();
  context.logout.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue({ items: fixtures(), next_cursor: "" });
  vi.mocked(switchToTenant).mockReset().mockResolvedValue(undefined);
  invites.items = [];
  invites.accept.mockReset();
  invites.decline.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

/** An organisation's row: its button is named by everything it shows, starting with the name. */
function row(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name}`) });
}

function sixth(): EligibleOrganization {
  return {
    ...fixture(2),
    id: "66666666-1111-4111-8111-111111111111",
    name: "Zenith Partners",
    slug: "zenith",
    domain: "zenith.example",
  };
}

describe("Organization selector", () => {
  it.each(["light", "dark"])("renders the memberships as one list in %s", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    render(<OrganizationSelectorView {...viewProps()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Choose an organisation" })).toBeTruthy();
    expect(
      screen.getByText("You belong to 5 organisations. Pick one to open its console."),
    ).toBeTruthy();
    const list = screen.getByRole("list", { name: "Your organisations" });
    expect(list.querySelectorAll("li")).toHaveLength(5);
    expect(screen.getAllByText("Last used")).toHaveLength(1);
    expect(screen.getByText("Billing manager")).toBeTruthy();
    // No domain: the slug stands in; a plan with its own copy shows it.
    expect(screen.getByText("nova · Pro")).toBeTruthy();
    // Five is short enough to need no search.
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("opens an organisation with one click", async () => {
    const props = viewProps();
    render(<OrganizationSelectorView {...props} />);
    fireEvent.click(row("Globalsphere"));
    await waitFor(() => expect(props.onContinue).toHaveBeenCalledWith(fixture(1).id));
  });

  it("does not invent a last-used organization or open one by itself", () => {
    const props = viewProps();
    render(
      <OrganizationSelectorView
        {...props}
        organizations={fixtures().map((organization) => ({ ...organization, last_used_at: null }))}
      />,
    );
    expect(screen.queryByText("Last used")).toBeNull();
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it("searches names, domains and slugs once the list is long", () => {
    render(<OrganizationSelectorView {...viewProps()} organizations={[...fixtures(), sixth()]} />);
    const search = screen.getByRole("searchbox", { name: "Search organisations" });
    fireEvent.change(search, { target: { value: "GLOBAL.EXAMPLE" } });
    expect(row("Globalsphere")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Your organisations" }).querySelectorAll("li"),
    ).toHaveLength(1);
    expect(screen.getByText("Showing 1 of 6")).toBeTruthy();
    fireEvent.change(search, { target: { value: "nova" } });
    expect(row("Nova Systems")).toBeTruthy();
    fireEvent.change(search, { target: { value: "not-a-member" } });
    expect(screen.getByText("No matching organisations")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    // Back to the most recently used.
    expect(
      screen.getByRole("list", { name: "Your organisations" }).querySelectorAll("li"),
    ).toHaveLength(5);
  });

  it("starts a long list with the five most recently used, and shows all on request", () => {
    render(<OrganizationSelectorView {...viewProps()} organizations={[...fixtures(), sixth()]} />);
    const rows = () =>
      [...screen.getByRole("list", { name: "Your organisations" }).querySelectorAll("li")].map(
        (item) => item.querySelector("strong")?.textContent,
      );
    expect(screen.getByText("Recently used")).toBeTruthy();
    expect(rows()).toHaveLength(5);
    expect(rows()[0]).toBe("Acme Technologies");
    fireEvent.click(screen.getByRole("button", { name: "Show all 6 organisations" }));
    expect(screen.getByText("All organisations, A to Z")).toBeTruthy();
    expect(rows()).toEqual([
      "Acme Technologies",
      "Globalsphere",
      "GreenField Labs",
      "Nova Systems",
      "Quantum Works",
      "Zenith Partners",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Show recently used only" }));
    expect(rows()).toHaveLength(5);
  });

  it("offers an explicit retry when the memberships can't be loaded", () => {
    const props = viewProps();
    render(<OrganizationSelectorView {...props} error />);
    expect(screen.queryByRole("list", { name: "Your organisations" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("drops a membership removed by a background refresh", () => {
    const props = viewProps();
    const view = render(<OrganizationSelectorView {...props} />);
    expect(row("Nova Systems")).toBeTruthy();
    view.rerender(
      <OrganizationSelectorView
        {...props}
        organizations={fixtures().filter((organization) => organization.name !== "Nova Systems")}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Nova Systems/ })).toBeNull();
  });

  it("prevents duplicate switching and presents a safe retryable error", async () => {
    const props = viewProps();
    let rejectSwitch: (error: Error) => void = () => {};
    props.onContinue = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectSwitch = reject;
        }),
    );
    render(<OrganizationSelectorView {...props} />);
    fireEvent.click(row("Globalsphere"));
    fireEvent.click(row("Acme Technologies"));
    expect(props.onContinue).toHaveBeenCalledTimes(1);
    const rows = screen
      .getByRole("list", { name: "Your organisations" })
      .querySelectorAll("button");
    expect([...rows].every((button) => button.matches(":disabled"))).toBe(true);
    await act(async () => rejectSwitch(new Error("private SQL membership query")));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("private SQL membership query")).toBeNull();
    expect(row("Globalsphere").matches(":disabled")).toBe(false);
  });

  it("connects create, account and sign-out actions", () => {
    const props = viewProps();
    render(<OrganizationSelectorView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a new organisation" }));
    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(props.onCreate).toHaveBeenCalledTimes(1);
    expect(props.onAccount).toHaveBeenCalledTimes(1);
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows loading without presenting a partial eligible list", () => {
    render(<OrganizationSelectorView {...viewProps()} loading />);
    expect(screen.getByRole("status", { name: "Loading your organisations…" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Your organisations" })).toBeNull();
  });
});

describe("Organization selection data", () => {
  it("retries a failed automatic switch after refreshing the single membership", async () => {
    vi.mocked(api).mockResolvedValue({ items: [fixture(1)], next_cursor: "" });
    vi.mocked(switchToTenant).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(switchToTenant).toHaveBeenCalledTimes(2));
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("loads every page so filtering includes all eligible organizations", async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({ items: fixtures().slice(0, 2), next_cursor: "next" })
      .mockResolvedValueOnce({ items: fixtures().slice(2), next_cursor: "" });
    expect(await loadEligibleOrganizations()).toHaveLength(5);
    expect(api).toHaveBeenLastCalledWith(
      "/v1/me/organizations",
      expect.objectContaining({ query: { limit: 200, cursor: "next" } }),
    );
  });

  it("rejects a repeated cursor instead of silently using a partial list", async () => {
    vi.mocked(api).mockResolvedValue({ items: fixtures().slice(0, 2), next_cursor: "same" });
    await expect(loadEligibleOrganizations()).rejects.toThrow("pagination did not advance");
  });

  it("uses deterministic ordering and ignores invalid last-used dates", () => {
    const organizations = fixtures().map((organization) => ({
      ...organization,
      last_used_at: "invalid",
    }));
    expect(mostRecentOrganization(organizations)).toBeNull();
    expect(filterOrganizations(organizations, "", "", "recent", "en")[0]?.name).toBe(
      "Acme Technologies",
    );
    expect(organizationImage("javascript:alert(1)")).toBeUndefined();
    expect(organizationImage("https://user:password@example.test/logo.png")).toBeUndefined();
  });

  it("keeps several organizations on the picker until one is chosen", async () => {
    renderPage();
    await screen.findByRole("button", { name: /^Globalsphere/ });
    expect(context.navigate).not.toHaveBeenCalled();
    expect(switchToTenant).not.toHaveBeenCalled();
    fireEvent.click(row("Globalsphere"));
    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith(fixture(1).id));
  });

  it("continues automatically when there is only one current organization", async () => {
    vi.mocked(api).mockResolvedValue({ items: [fixture(0)], next_cursor: "" });
    renderPage();
    await waitFor(() => expect(context.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    expect(switchToTenant).not.toHaveBeenCalled();
  });

  it("switches automatically when the only remaining membership is not the current tenant", async () => {
    vi.mocked(api).mockResolvedValue({ items: [fixture(1)], next_cursor: "" });
    renderPage();
    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith(fixture(1).id));
  });

  it("takes an account with no organisation and no invitation on to create its first", async () => {
    vi.mocked(api).mockResolvedValue({ items: [], next_cursor: "" });
    renderPage();
    await waitFor(() =>
      expect(context.navigate).toHaveBeenCalledWith({ to: "/create-organization", replace: true }),
    );
    expect(switchToTenant).not.toHaveBeenCalled();
  });

  it("shows a new account its invitation instead: join it, decline it, or create one", async () => {
    vi.mocked(api).mockResolvedValue({ items: [], next_cursor: "" });
    invites.items = [invitation("inv-1", "Globex India")];
    const onCreate = vi.fn();
    renderPage(onCreate);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Join Globex India" }),
    ).toBeTruthy();
    expect(screen.getByText(/Invited as operator@example.test · expires in 6 days/)).toBeTruthy();
    expect(context.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create a new organisation instead" }));
    expect(onCreate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Join Globex India" }));
    expect(invites.accept).toHaveBeenCalledWith("inv-1", expect.anything());
    // Joining reloads into the organisation; until then nothing else can start.
    expect(
      screen
        .getByRole("button", { name: "Create a new organisation instead" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("says in place when joining fails, and leaves the invitation to try again", async () => {
    vi.mocked(api).mockResolvedValue({ items: [], next_cursor: "" });
    invites.items = [invitation("inv-1", "Globex India")];
    invites.accept.mockImplementation((_id, options) => options.onError(new Error("private")));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Join Globex India" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "We couldn't add you to that organisation",
    );
    expect(document.body.textContent).not.toContain("private");
    expect(
      screen.getByRole("button", { name: "Join Globex India" }).getAttribute("aria-disabled"),
    ).not.toBe("true");
  });

  it("lists several invitations, each joined or declined on its own row", async () => {
    vi.mocked(api).mockResolvedValue({ items: [], next_cursor: "" });
    invites.items = [invitation("inv-1", "Globex India"), invitation("inv-2", "Initech")];
    invites.decline.mockImplementation((_id, options) => options.onSettled());
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: "You've been invited" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Decline the invitation to Initech" }));
    expect(invites.decline).toHaveBeenCalledWith("inv-2", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Join Globex India" }));
    expect(invites.accept).toHaveBeenCalledWith("inv-1", expect.anything());
  });

  it("shows a member their invitations above their organisations, and doesn't go on without them", async () => {
    vi.mocked(api).mockResolvedValue({ items: [fixture(1)], next_cursor: "" });
    invites.items = [invitation("inv-1", "Globex India")];
    renderPage();
    const list = await screen.findByRole("list", { name: "Invitations" });
    expect(list.textContent).toContain("Globex India");
    expect(screen.getByRole("list", { name: "Your organisations" }).textContent).toContain(
      "Globalsphere",
    );
    expect(switchToTenant).not.toHaveBeenCalled();
    expect(context.navigate).not.toHaveBeenCalled();
  });

  it("does not fetch memberships without an authenticated identity", () => {
    context.userId = null;
    renderPage();
    expect(api).not.toHaveBeenCalled();
  });
});
