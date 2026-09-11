// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import "@/i18n";
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useMyInvitations,
  usePasskeys,
} from "@/modules/authentication";
import { useMe } from "@/platform/auth/session";

import { NoWorkspaceOnboarding } from "../components/no-workspace-onboarding";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("@/modules/authentication", () => ({
  useAcceptInvitation: vi.fn(),
  useDeclineInvitation: vi.fn(),
  useMyInvitations: vi.fn(),
  usePasskeys: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useMe: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), message: vi.fn() } }));

const accept = vi.fn();
const decline = vi.fn();
const refetchMe = vi.fn();
const refetchPasskeys = vi.fn();
const user = {
  id: "user-1",
  tenant_id: "",
  email: "operator@example.com",
  email_verified_at: "2026-09-10T00:00:00Z",
  status: "active",
};
const invite = {
  id: "invite-1",
  tenant_id: "tenant-1",
  tenant_name: "Example team",
  tenant_slug: "example-team",
  email: "operator@example.com",
  expires_at: "2026-10-01T00:00:00Z",
  created_at: "2026-09-10T00:00:00Z",
};

function mockMe(overrides: Record<string, unknown> = {}) {
  vi.mocked(useMe).mockReturnValue({
    data: user,
    isError: false,
    isFetching: false,
    refetch: refetchMe,
    ...overrides,
  } as unknown as ReturnType<typeof useMe>);
}

function mockPasskeys(overrides: Record<string, unknown> = {}) {
  vi.mocked(usePasskeys).mockReturnValue({
    data: { items: [{ id: "passkey-1" }] },
    isError: false,
    isFetching: false,
    refetch: refetchPasskeys,
    ...overrides,
  } as unknown as ReturnType<typeof usePasskeys>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMe();
  mockPasskeys();
  vi.mocked(useMyInvitations).mockReturnValue({ data: { items: [] } } as unknown as ReturnType<
    typeof useMyInvitations
  >);
  vi.mocked(useAcceptInvitation).mockReturnValue({
    mutate: accept,
    isPending: false,
  } as unknown as ReturnType<typeof useAcceptInvitation>);
  vi.mocked(useDeclineInvitation).mockReturnValue({
    mutate: decline,
    isPending: false,
  } as unknown as ReturnType<typeof useDeclineInvitation>);
});
afterEach(cleanup);

describe("first-organization dashboard", () => {
  it("keeps light-mode gutters transparent and uses the console card surface", () => {
    const { container } = render(<NoWorkspaceOnboarding onStart={vi.fn()} />);
    const dashboard = container.querySelector('[data-slot="workspace-welcome"]');
    const panels = container.querySelector('[data-slot="welcome-panels"]');

    expect(dashboard?.classList.contains("[--welcome-surface:var(--card)]")).toBe(true);
    expect(dashboard?.classList.contains("[--welcome-soft:var(--surface-subtle)]")).toBe(true);
    expect(panels?.classList.contains("bg-transparent")).toBe(true);
    expect(panels?.classList.contains("border-transparent")).toBe(true);
    expect(panels?.classList.contains("shadow-none")).toBe(true);
    expect(panels?.className).not.toContain("bg-linear-");
    expect(dashboard?.classList.contains("dark:[--welcome-surface:#161d23]")).toBe(true);
  });

  it("renders the reference sections and preserves the creation and security actions", () => {
    const onStart = vi.fn();
    render(<NoWorkspaceOnboarding onStart={onStart} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Create your first organization",
    );
    for (const name of [
      "What an organization establishes",
      "Get started with Qeet ID",
      "Your account is ready",
      "Need help getting started?",
    ]) {
      expect(screen.getByRole("heading", { name, level: 2 })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
    fireEvent.click(screen.getByRole("button", { name: "Create your organization" }));
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("link", { name: "Review account security" }).getAttribute("href")).toBe(
      "/account/security",
    );
  });

  it("shows zero organization steps complete rather than counting personal account checks", () => {
    render(<NoWorkspaceOnboarding onStart={vi.fn()} />);
    const progress = screen.getByRole("progressbar", { name: "Organization setup progress" });
    expect(progress.getAttribute("value")).toBe("0");
    expect(progress.getAttribute("max")).toBe("3");
    expect(screen.getByText("0 of 3 complete")).toBeTruthy();
    const checklist = screen.getByRole("region", { name: "Get started with Qeet ID" });
    expect(within(checklist).getAllByRole("listitem")).toHaveLength(3);
    expect(within(checklist).queryAllByRole("link")).toHaveLength(0);
  });

  it("collapses and restores the checklist with an accessible relationship", () => {
    render(<NoWorkspaceOnboarding onStart={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Collapse getting-started checklist" });
    const steps = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(steps?.hasAttribute("hidden")).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(steps?.hasAttribute("hidden")).toBe(true);
    expect(screen.getByText("0 of 3 complete")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand getting-started checklist" }));
    expect(steps?.hasAttribute("hidden")).toBe(false);
  });

  it("does not offer dead creation buttons when no callback is supplied", () => {
    render(<NoWorkspaceOnboarding />);
    const primary = screen.getByRole("button", { name: "Create organization" });
    const firstStep = screen.getByRole("button", { name: "Create your organization" });
    expect(primary.matches(":disabled")).toBe(true);
    expect(firstStep.matches(":disabled")).toBe(true);
  });

  it("links to real documentation, support and legal destinations", () => {
    render(<NoWorkspaceOnboarding onStart={vi.fn()} />);
    const documentation = screen.getByRole("link", { name: /View documentation/ });
    expect(documentation.getAttribute("href")).toBe("https://docs.id.qeet.in");
    expect(documentation.getAttribute("target")).toBe("_blank");
    expect(documentation.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: /Contact support/ }).getAttribute("href")).toBe(
      "https://id.qeet.in/contact",
    );
    const footer = within(screen.getByRole("navigation", { name: "Dashboard resources" }));
    expect(footer.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe(
      "https://id.qeet.in/legal/privacy",
    );
  });
});

describe("account readiness is backed by data", () => {
  it("shows all three confirmed checks for an active, verified account with a passkey", () => {
    render(<NoWorkspaceOnboarding />);
    const account = screen.getByRole("region", { name: "Your account is ready" });
    expect(within(account).getByRole("heading", { name: "Identity verified" })).toBeTruthy();
    expect(within(account).getByRole("heading", { name: "Passkeys enabled" })).toBeTruthy();
    expect(within(account).getByRole("heading", { name: "Account secured" })).toBeTruthy();
    expect(account.querySelectorAll('li[data-state="complete"]')).toHaveLength(3);
  });

  it("never claims a passkey is enabled when the account has none", () => {
    mockPasskeys({ data: { items: [] } });
    render(<NoWorkspaceOnboarding />);
    expect(screen.getByRole("heading", { name: "Finish securing your account" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Passkeys enabled" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Account secured" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Identity verified" })).toBeTruthy();
  });

  it("does not label an unverified email as verified", () => {
    mockMe({ data: { ...user, email_verified_at: null } });
    render(<NoWorkspaceOnboarding />);
    expect(screen.queryByRole("heading", { name: "Identity verified" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Your account is ready" })).toBeNull();
  });

  it("does not show account readiness for an inactive account", () => {
    mockMe({ data: { ...user, status: "suspended" } });
    render(<NoWorkspaceOnboarding />);
    expect(screen.queryByRole("heading", { name: "Account secured" })).toBeNull();
  });

  it("renders a neutral loading state instead of optimistic green checks", () => {
    mockMe({ data: undefined, isFetching: true });
    mockPasskeys({ data: undefined, isFetching: true });
    render(<NoWorkspaceOnboarding />);
    const account = screen.getByRole("region", { name: "Checking your account" });
    expect(within(account).getByRole("list").getAttribute("aria-busy")).toBe("true");
    expect(account.querySelectorAll('li[data-state="complete"]')).toHaveLength(0);
  });

  it("invalidates stale positive checks on an error and offers retry", () => {
    mockMe({ isError: true });
    mockPasskeys({ isError: true });
    render(<NoWorkspaceOnboarding />);
    const account = screen.getByRole("region", { name: "Account status unavailable" });
    expect(account.querySelectorAll('li[data-state="complete"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(refetchMe).toHaveBeenCalledOnce();
    expect(refetchPasskeys).toHaveBeenCalledOnce();
  });
});

describe("pending organization invitations", () => {
  beforeEach(() => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: { items: [invite] },
    } as unknown as ReturnType<typeof useMyInvitations>);
  });

  it("preserves accepting and declining an existing invitation", () => {
    render(<NoWorkspaceOnboarding onStart={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "You’ve been invited" })).toBeTruthy();
    expect(screen.getByText("Example team")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept & join" }));
    expect(accept).toHaveBeenCalledWith("invite-1", expect.any(Object));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(decline).toHaveBeenCalledWith("invite-1", expect.any(Object));
  });

  it("prevents concurrent invitation actions", () => {
    vi.mocked(useAcceptInvitation).mockReturnValue({
      mutate: accept,
      isPending: true,
    } as unknown as ReturnType<typeof useAcceptInvitation>);
    render(<NoWorkspaceOnboarding onStart={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Accept & join" });
    expect(button.matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Decline" }).matches(":disabled")).toBe(true);
    fireEvent.click(button);
    expect(accept).not.toHaveBeenCalled();
  });

  it("does not expose raw invitation errors", () => {
    render(<NoWorkspaceOnboarding onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept & join" }));
    accept.mock.calls[0][1].onError(new Error("internal database host and secret details"));
    expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.");
  });
});
