// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";
import { type Plan, startSignupCheckout, submitSalesLead, usePlans } from "@/modules/billing";
import { api } from "@/platform/api/client";
import type { PublicSession } from "@/platform/auth/server-session";
import { ApiError } from "@/platform/errors/api-error";
import { CreateOrganizationPage, type CreateOrganizationFrom } from "../entry-pages";
import { loadPage } from "../load-page";
import { readPendingOnboarding, stashOnboardingProfile } from "../onboarding-profile";
import type { CheckoutParams } from "../use-checkout-return";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => null,
  useUserId: () => "user-1",
  useMe: () => ({ data: { id: "user-1", email: "mira@example.com", display_name: "Mira Menon" } }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
// Mira already belongs to an organisation, unless a test says otherwise.
const memberships = vi.hoisted(() => ({ member: true }));
vi.mock("../api/memberships", () => ({
  useHasOrganization: () => ({ data: memberships.member }),
}));
vi.mock("@/platform/auth/session-store", () => ({ sessionStore: { hydrate: vi.fn() } }));
vi.mock("../load-page", () => ({ loadPage: vi.fn() }));
vi.mock("@/modules/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/billing")>()),
  usePlans: vi.fn(),
  startSignupCheckout: vi.fn(),
  submitSalesLead: vi.fn(),
}));

const plan = (code: string, name: string, prices: Record<string, number>): Plan => ({
  id: code,
  code,
  name,
  description: `${name} catalogue line`,
  interval: code.endsWith("_year") ? "year" : "month",
  features: [`${name} feature one`, `${name} feature two`],
  prices,
});
const catalogue = [
  plan("free", "Free", { INR: 0, USD: 0 }),
  plan("starter", "Starter", { INR: 240_000, USD: 2_900 }),
  plan("pro", "Pro", { INR: 800_000, USD: 9_900 }),
  plan("enterprise", "Enterprise", { INR: 2_490_000, USD: 29_900 }),
  plan("starter_year", "Starter", { INR: 2_400_000, USD: 29_000 }),
  plan("pro_year", "Pro", { INR: 8_000_000, USD: 99_000 }),
];
const session = { isAuthenticated: true, userId: "user-1", tenantId: null } as PublicSession;
const refetch = vi.fn();

function mount(from?: CreateOrganizationFrom, checkout?: CheckoutParams) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreateOrganizationPage session={session} from={from} checkout={checkout} />
    </QueryClientProvider>,
  );
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => fireEvent.click(button(name));
const textbox = (name: string) => screen.getByRole<HTMLInputElement>("textbox", { name });
const type = (name: string, value: string) =>
  fireEvent.change(textbox(name), { target: { value } });
const card = (tier: string) => document.querySelector<HTMLElement>(`[data-tier="${tier}"]`);
const heading = () => screen.getByRole("heading", { level: 1 });

/** From the plans to the details, choosing `plan` and skipping the project questions. */
function toDetails(name = "Free") {
  fireEvent.click(screen.getByRole("radio", { name }));
  click(`Continue with ${name}`);
  click("Skip");
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  memberships.member = true;
  vi.mocked(usePlans).mockReturnValue({
    data: { items: catalogue },
    isLoading: false,
    isError: false,
    refetch,
  } as unknown as ReturnType<typeof usePlans>);
  vi.mocked(api).mockResolvedValue({ tenant_id: "org-1", tenant: { id: "org-1" } });
});
afterEach(() => cleanup());

describe("create an organisation", () => {
  it("starts on Free, and Continue names the plan chosen", () => {
    mount();
    expect(heading().textContent).toBe("Create an organisation");
    expect(screen.getByRole("radio", { name: "Free" }).getAttribute("aria-checked")).toBe("true");
    expect(button("Continue with Free")).toBeTruthy();
    expect(within(card("pro") as HTMLElement).getByText("Most popular")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Pro" }));
    expect(card("pro")?.hasAttribute("data-selected")).toBe(true);
    expect(button("Continue with Pro")).toBeTruthy();
  });

  it("shows what paying yearly saves, in money", () => {
    mount();
    const starter = () => within(card("starter") as HTMLElement);
    expect(starter().getByText("₹2,400")).toBeTruthy();
    expect(card("starter")?.textContent).toContain("Or ₹24,000 billed yearly, saving ₹4,800");
    click("Yearly · save 17%");
    expect(starter().getByText("₹24,000")).toBeTruthy();
    expect(starter().getByText("Instead of ₹28,800")).toBeTruthy();
    expect(card("starter")?.textContent).toContain("₹2,000 a month · you save ₹4,800 (17%)");
    expect(card("pro")?.textContent).toContain("₹6,667 a month · you save ₹16,000 (17%)");
    expect(card("free")?.textContent).toContain("Free for as long as you like");
  });

  it("creates a Free organisation: the URL follows the name, and the console opens in it", async () => {
    mount();
    click("Continue with Free");
    expect(heading().textContent).toBe("Tell us about your project");
    expect(document.activeElement).toBe(heading());
    click("Skip");
    expect(heading().textContent).toBe("Name your organisation");
    type("Organisation name", "Acme Payments");
    expect(textbox("Organisation URL").value).toBe("acme-payments");
    expect(screen.getByText("It's created straight away, and you're taken into it.")).toBeTruthy();
    click("Create organisation");
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/"));
    expect(api).toHaveBeenCalledExactlyOnceWith("/v1/tenants", {
      method: "POST",
      body: {
        slug: "acme-payments",
        name: "Acme Payments",
        plan: "free",
        region: "ap-south-1",
        logo_url: undefined,
      },
    });
    expect(startSignupCheckout).not.toHaveBeenCalled();
    expect(readPendingOnboarding("user-1")).toMatchObject({ profile: {}, slug: "acme-payments" });
  });

  it("sends a paid plan to checkout with its cycle and currency, creating nothing first", async () => {
    vi.mocked(startSignupCheckout).mockResolvedValue({
      status: "checkout",
      checkout_url: "https://pay.example/checkout/1",
    } as Awaited<ReturnType<typeof startSignupCheckout>>);
    mount();
    click("Yearly · save 17%");
    toDetails("Pro");
    const summary = screen.getByRole("complementary", { name: "Your plan" });
    expect(summary.textContent).toContain("₹80,000 a year");
    expect(summary.textContent).toContain("You'll pay on the next page.");
    type("Organisation name", "Acme Payments");
    type("Organisation URL", "acme");
    click("Continue to payment");
    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("https://pay.example/checkout/1"));
    expect(startSignupCheckout).toHaveBeenCalledExactlyOnceWith({
      orgName: "Acme Payments",
      orgSlug: "acme",
      region: "ap-south-1",
      planCode: "pro_year",
      currency: "INR",
      country: "IN",
      successUrl: `${window.location.origin}/create-organization?checkout=success`,
      cancelUrl: `${window.location.origin}/create-organization?checkout=cancelled`,
    });
    expect(api).not.toHaveBeenCalled();
    // Kept for a cancelled payment, and to name the organisation while it's being made.
    expect(readPendingOnboarding("user-1")?.draft).toEqual({
      name: "Acme Payments",
      region: "ap-south-1",
      tier: "pro",
      cycle: "year",
      currency: "INR",
    });
  });

  it("sets up a first organisation with nowhere to cancel back to", () => {
    memberships.member = false;
    mount();
    expect(heading().textContent).toBe("Set up your organisation");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    cleanup();
    // Opened from somewhere, there is somewhere to go back to.
    mount("select-organization");
    expect(heading().textContent).toBe("Create an organisation");
    expect(button("Cancel")).toBeTruthy();
  });

  it("back from a cancelled payment, puts the details back as they were", () => {
    stashOnboardingProfile({
      profile: { use_case: "b2b_saas" },
      slug: "acme",
      userId: "user-1",
      draft: { name: "Acme", region: "eu-west-1", tier: "pro", cycle: "year", currency: "INR" },
    });
    mount(undefined, { checkout: "cancelled" });
    expect(heading().textContent).toBe("Name your organisation");
    expect(screen.getByText("Payment cancelled")).toBeTruthy();
    expect(textbox("Organisation name").value).toBe("Acme");
    expect(textbox("Organisation URL").value).toBe("acme");
    const summary = screen.getByRole("complementary", { name: "Your plan" });
    expect(summary.textContent).toContain("₹80,000 a year");
    // The checkout's fields leave the address.
    expect(navigate).toHaveBeenCalledWith({
      to: "/create-organization",
      search: {},
      replace: true,
    });
  });

  it("back from a payment, finishes the organisation it paid for", () => {
    stashOnboardingProfile({
      profile: {},
      slug: "acme",
      userId: "user-1",
      draft: { name: "Acme", region: "ap-south-1", tier: "pro", cycle: "month", currency: "INR" },
    });
    vi.mocked(api).mockReturnValue(new Promise(() => {}));
    mount(undefined, { checkout: "success" });
    expect(heading().textContent).toBe("Finishing your organisation");
    expect(screen.getByText(/Payment received for Acme on Pro/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Setting up Acme…");
  });

  it("says a taken URL on its field, and the form stays usable", async () => {
    vi.mocked(api).mockRejectedValue(
      new ApiError(409, "tenant.slug_taken", "slug taken", "uq_tenants_slug"),
    );
    mount();
    toDetails();
    type("Organisation name", "Acme Payments");
    click("Create organisation");
    expect(
      await screen.findByText(
        "acme-payments is already taken. Choose another URL; the name can stay the same.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(button("Create organisation").getAttribute("aria-disabled")).not.toBe("true");
    expect(loadPage).not.toHaveBeenCalled();
    type("Organisation URL", "acme-payments-in");
    expect(screen.queryByText(/is already taken/)).toBeNull();
  });

  it("shows any other failure above the actions, in the console's words", async () => {
    vi.mocked(api).mockRejectedValue(
      new ApiError(500, "test.failure", "private backend message", "private detail"),
    );
    mount();
    toDetails();
    type("Organisation name", "Acme Payments");
    click("Create organisation");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The organisation wasn't created");
    expect(alert.textContent).toContain("Something went wrong. Please try again.");
    expect(document.body.textContent).not.toContain("private");
  });

  it("checks the name and URL before sending anything", () => {
    mount();
    toDetails();
    click("Create organisation");
    expect(screen.getByText("Enter a name for the organisation.")).toBeTruthy();
    expect(screen.getByText("Use 2 to 64 lowercase letters, numbers and hyphens.")).toBeTruthy();
    type("Organisation name", "Acme");
    type("Organisation URL", "Acme Pay");
    click("Create organisation");
    expect(screen.getByText("Use 2 to 64 lowercase letters, numbers and hyphens.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("keeps what was entered when going back, and Change returns to the plans", () => {
    mount();
    toDetails("Starter");
    type("Organisation name", "Acme Payments");
    type("Organisation URL", "acme-custom");
    click("Back");
    click("Continue");
    expect(textbox("Organisation name").value).toBe("Acme Payments");
    // A URL typed in stops following the name.
    type("Organisation name", "Acme Payments India");
    expect(textbox("Organisation URL").value).toBe("acme-custom");
    click("Change");
    expect(heading().textContent).toBe("Create an organisation");
    expect(screen.getByRole("radio", { name: "Starter" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("previews a chosen logo, sends it, and lets it be removed", async () => {
    mount();
    toDetails();
    const file = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/^Logo/), { target: { files: [file] } });
    const preview = await screen.findByRole("img", { name: "Logo preview" });
    expect(preview.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    type("Organisation name", "Acme");
    click("Create organisation");
    await waitFor(() => expect(api).toHaveBeenCalled());
    const body = vi.mocked(api).mock.calls[0]?.[1]?.body as { logo_url?: string };
    expect(body.logo_url).toMatch(/^data:image\/png;base64,/);
    cleanup();
    mount();
    toDetails();
    fireEvent.change(screen.getByLabelText(/^Logo/), { target: { files: [file] } });
    await screen.findByRole("img", { name: "Logo preview" });
    click(/Remove/);
    expect(screen.queryByRole("img", { name: "Logo preview" })).toBeNull();
  });

  it("takes Enterprise to sales in the page: filled in, sent, then Free meanwhile", async () => {
    vi.mocked(submitSalesLead).mockResolvedValue({ status: "ok" });
    mount("select-organization");
    fireEvent.click(screen.getByRole("radio", { name: "Enterprise" }));
    click("Talk to sales");
    expect(heading().textContent).toBe("Talk to our sales team");
    expect(textbox("Your name").value).toBe("Mira Menon");
    expect(textbox("Work email").value).toBe("mira@example.com");
    type("Company", "Acme");
    click("Send to sales");
    expect(await screen.findByRole("heading", { name: "Thanks, we'll be in touch" })).toBeTruthy();
    expect(submitSalesLead).toHaveBeenCalledExactlyOnceWith(
      {
        name: "Mira Menon",
        email: "mira@example.com",
        company: "Acme",
        team_size: "",
        message: "",
        source: "onboarding",
      },
      expect.anything(),
    );
    expect(screen.getByText(/We'll reply to mira@example.com/)).toBeTruthy();
    expect(button("Back to your organisations")).toBeTruthy();
    click("Start on Free meanwhile");
    expect(heading().textContent).toBe("Tell us about your project");
    click("Change");
    expect(screen.getByRole("radio", { name: "Free" }).getAttribute("aria-checked")).toBe("true");
  });

  it.each([
    [undefined, "/"],
    ["select-organization", "/select-organization"],
    ["organizations", "/organizations"],
  ] as const)("Cancel goes back where it was opened from (%s)", (from, to) => {
    mount(from);
    click("Cancel");
    expect(navigate).toHaveBeenCalledWith({ to });
  });

  it("offers a retry when the plans don't load, and nothing can go on", () => {
    vi.mocked(usePlans).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof usePlans>);
    mount();
    expect(screen.getByText("We couldn't load the plans")).toBeTruthy();
    click("Try again");
    expect(refetch).toHaveBeenCalledOnce();
    expect(button("Continue").getAttribute("aria-disabled")).toBe("true");
  });
});
