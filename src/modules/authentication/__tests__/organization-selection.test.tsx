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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

async function selectOption(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }), { button: 0 });
  const target = await screen.findByRole("option", { name: option });
  fireEvent.pointerDown(target, { pointerType: "mouse", button: 0 });
  fireEvent.click(target);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <OrganizationSelectionPage onCreate={vi.fn()} />
      </QueryClientProvider>,
    ),
    client,
  };
}

beforeEach(() => {
  context.userId = "user-a";
  context.tenantId = fixtures()[0].id;
  context.navigate.mockReset();
  context.logout.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue({ items: fixtures(), next_cursor: "" });
  vi.mocked(switchToTenant).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

describe("Organization selector", () => {
  it.each(["light", "dark"])(
    "renders the same reference layout and real membership data in %s",
    (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      const { container } = render(<OrganizationSelectorView {...viewProps()} />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Select an organization" }),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "You're a member of 5 organizations. Choose one to continue to the dashboard.",
        ),
      ).toBeTruthy();
      expect(screen.getAllByRole("radio")).toHaveLength(5);
      expect(
        (screen.getByRole("radio", { name: "Acme Technologies" }) as HTMLInputElement).checked,
      ).toBe(true);
      expect(screen.getByText("Last used")).toBeTruthy();
      expect(screen.getByText("Billing manager")).toBeTruthy();
      expect(screen.queryByText("Professional")).toBeNull();
      expect(screen.queryByText("nova.com")).toBeNull();
      for (const element of container.querySelectorAll("[class]"))
        expect(element.getAttribute("class")).not.toMatch(
          /\bdark:(hidden|block|grid|flex|order-|p[xy]-|m[xy]-)/,
        );
    },
  );

  it("changes only the selected card until Continue explicitly submits", async () => {
    const props = viewProps();
    render(<OrganizationSelectorView {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Globalsphere" }));
    expect(props.onContinue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue to dashboard" }));
    await waitFor(() => expect(props.onContinue).toHaveBeenCalledWith(fixtures()[1].id));
  });

  it("does not invent a last-used organization or automatically choose an unused one", () => {
    render(
      <OrganizationSelectorView
        {...viewProps()}
        organizations={fixtures().map((organization) => ({ ...organization, last_used_at: null }))}
      />,
    );
    expect(screen.queryByText("Last used")).toBeNull();
    expect(screen.getAllByRole("radio").some((input) => (input as HTMLInputElement).checked)).toBe(
      false,
    );
    expect(
      screen.getByRole("button", { name: "Continue to dashboard" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("searches names, domains and slugs without submitting a hidden selection", () => {
    const props = viewProps();
    render(<OrganizationSelectorView {...props} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "GLOBAL.EXAMPLE" } });
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Continue to dashboard" }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Continue to dashboard" }));
    expect(props.onContinue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nova" } });
    expect(screen.getByRole("radio", { name: "Nova Systems" })).toBeTruthy();
  });

  it("filters actual roles and retains the selected filter label", async () => {
    render(<OrganizationSelectorView {...viewProps()} />);
    await selectOption("Filter by role", "Admin");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Filter by role" }).textContent).toContain("Admin");
    await selectOption("Filter by role", "Billing manager");
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Quantum Works" })).toBeTruthy();
  });

  it("sorts names and changes layout without losing the chosen organization", async () => {
    const { container } = render(<OrganizationSelectorView {...viewProps()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Nova Systems" }));
    await selectOption("Sort organizations", "Name: Z to A");
    expect(screen.getAllByRole("radio")[0].getAttribute("aria-label")).toBe("Quantum Works");
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(container.querySelector('[data-organization-layout="list"]')).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Nova Systems" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("offers filter reset and explicit retry states", () => {
    const props = viewProps();
    const view = render(<OrganizationSelectorView {...props} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "not-a-member" } });
    expect(screen.getByText("No matching organizations")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    view.rerender(<OrganizationSelectorView {...props} error />);
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables stale selections removed by a background membership refresh", () => {
    const props = viewProps();
    const view = render(<OrganizationSelectorView {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Nova Systems" }));
    view.rerender(
      <OrganizationSelectorView
        {...props}
        organizations={fixtures().filter((organization) => organization.name !== "Nova Systems")}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Continue to dashboard" }).hasAttribute("disabled"),
    ).toBe(true);
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
    fireEvent.click(screen.getByRole("button", { name: "Continue to dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Opening organization..." }));
    expect(props.onContinue).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("radio").every((radio) => radio.matches(":disabled"))).toBe(true);
    await act(async () => rejectSwitch(new Error("private SQL membership query")));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("private SQL membership query")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Continue to dashboard" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("connects create, account and sign-out actions", () => {
    const props = viewProps();
    render(<OrganizationSelectorView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a new organization" }));
    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(props.onCreate).toHaveBeenCalledTimes(1);
    expect(props.onAccount).toHaveBeenCalledTimes(1);
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows loading without presenting a partial eligible list", () => {
    render(<OrganizationSelectorView {...viewProps()} loading />);
    expect(screen.getByRole("status", { name: "Loading your organizations..." })).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("Organization selection data", () => {
  it("retries a failed automatic switch after refreshing the single membership", async () => {
    vi.mocked(api).mockResolvedValue({ items: [fixtures()[1]], next_cursor: "" });
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
    expect(filterOrganizations(organizations, "", "", "recent", "en")[0].name).toBe(
      "Acme Technologies",
    );
    expect(organizationImage("javascript:alert(1)")).toBeUndefined();
    expect(organizationImage("https://user:password@example.test/logo.png")).toBeUndefined();
  });

  it("keeps multiple organizations on the selector until Continue", async () => {
    renderPage();
    await screen.findByRole("radio", { name: "Globalsphere" });
    expect(context.navigate).not.toHaveBeenCalled();
    expect(switchToTenant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Globalsphere" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to dashboard" }));
    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith(fixtures()[1].id));
  });

  it("continues automatically when there is only one current organization", async () => {
    vi.mocked(api).mockResolvedValue({ items: [fixtures()[0]], next_cursor: "" });
    renderPage();
    await waitFor(() => expect(context.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    expect(switchToTenant).not.toHaveBeenCalled();
  });

  it("switches automatically when the only remaining membership is not the current tenant", async () => {
    vi.mocked(api).mockResolvedValue({ items: [fixtures()[1]], next_cursor: "" });
    renderPage();
    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith(fixtures()[1].id));
  });

  it("keeps org-less accounts on the existing onboarding path", async () => {
    vi.mocked(api).mockResolvedValue({ items: [], next_cursor: "" });
    renderPage();
    await waitFor(() => expect(context.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    expect(switchToTenant).not.toHaveBeenCalled();
  });

  it("does not fetch memberships without an authenticated identity", () => {
    context.userId = null;
    renderPage();
    expect(api).not.toHaveBeenCalled();
  });
});
