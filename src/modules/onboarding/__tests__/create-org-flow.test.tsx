// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";
import { type Plan, startSignupCheckout, usePlans } from "@/modules/billing";
import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { CreateOrgFlow } from "../create-org-flow";
import { readStashedProfile } from "../onboarding-profile";
import { OrgOnboarding } from "../org-onboarding";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => null }));
vi.mock("@/modules/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/billing")>();
  return {
    ...actual,
    usePlans: vi.fn(),
    startSignupCheckout: vi.fn(),
    ContactSalesDialog: () => null,
  };
});

function plan(code: string, name: string, price = 0): Plan {
  return {
    id: code,
    code,
    name,
    description: `${name} catalogue description`,
    interval: code.endsWith("_year") ? "year" : "month",
    features: [`${name} support`],
    prices: { INR: price * 80, USD: price },
  };
}
const catalogue = [
  plan("free", "Free"),
  plan("starter", "Starter", 2_900),
  plan("pro", "Pro", 9_900),
  plan("enterprise", "Enterprise"),
  plan("starter_year", "Starter", 29_000),
  plan("pro_year", "Pro", 99_000),
];
const project = [
  ["What are you building?", "B2B SaaS (customers log into my product)"],
  ["How big is your team?", "2–10"],
  ["Your role", "Engineer"],
] as const;
const logo = "https://example.test/logo.png";
const created = {
  tenant_id: "org-fixture",
  tenant: { id: "org-fixture", name: "Final Org", slug: "custom-org", plan: "free" },
};
const onDone = vi.fn();
const onCancel = vi.fn();
const network = vi.fn(() => {
  throw new Error("Unexpected real request");
});
let client: QueryClient;
const mount = (ui: ReactNode = <CreateOrgFlow onDone={onDone} onCancel={onCancel} />) =>
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
const input = (name: string) => screen.getByRole<HTMLInputElement>("textbox", { name });
/**
 * Reveals the logo URL field. It's behind an "Upload via URL" toggle so the
 * form offers one URL input rather than a permanently visible second box next
 * to the file picker.
 */
const revealLogoUrl = () => {
  const toggle = screen.queryByRole("button", { name: "Upload via URL" });
  if (toggle) fireEvent.click(toggle);
};
const change = (name: string, value: string) =>
  fireEvent.change(input(name), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const pick = (name = "Free") =>
  fireEvent.click(within(screen.getByRole("article", { name })).getByRole("button"));
const details = () => screen.getByRole("form", { name: "Create your organization" });

async function select(label: string, value: string) {
  const trigger = screen.getByRole("combobox", { name: label });
  expect(screen.getByLabelText(label)).toBe(trigger);
  fireEvent.mouseDown(trigger, { button: 0 });
  const option = await screen.findByRole("option", { name: value });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
}
function progress(current: string) {
  const nav = within(screen.getByRole("navigation", { name: "Organization setup progress" }));
  expect(nav.getByRole("listitem", { current: "step" }).textContent).toContain(current);
  for (const label of ["Invite your team", "Launch"]) {
    const step = nav.getByText(label).closest("li");
    expect(step?.getAttribute("aria-current")).toBeNull();
    expect(step?.textContent).toContain("After creation");
    expect(step?.textContent).not.toContain("Complete");
  }
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.stubGlobal("fetch", network);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(usePlans).mockReturnValue({
    data: { items: catalogue },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof usePlans>);
  vi.mocked(api).mockResolvedValue(created);
  vi.mocked(startSignupCheckout).mockResolvedValue({ status: "active" });
});
afterEach(() => {
  cleanup();
  client.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  expect(network).not.toHaveBeenCalled();
});

describe("CreateOrgFlow / OrgOnboarding", () => {
  it("uses a browser-compatible slug pattern for lowercase, digits and hyphens", () => {
    mount();
    pick();
    click("Skip for now");
    const slugInput = input("Slug");
    const pattern = new RegExp(`^(?:${slugInput.pattern})$`, "v");
    expect(pattern.test("qeet-team-42")).toBe(true);
    expect(pattern.test("Qeet Team!")).toBe(false);
    change("Slug", "qeet-team-42");
    expect(slugInput.checkValidity()).toBe(true);
    change("Slug", "invalid slug");
    expect(slugInput.checkValidity()).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });

  // The only test that walks the whole wizard forward, back and forward again,
  // with four async select interactions: ~2s here, ~6s on CI's slower runners,
  // so the 5s default is not enough. Every other test in this file stays under
  // 600ms — raise this one rather than relaxing the default for all of them.
  it("preserves project, details, logo and manual slug through Back", async () => {
    mount(<OrgOnboarding onDone={onDone} onCancel={onCancel} />);
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Choose plan");
    click("Cancel setup");
    expect(onCancel).toHaveBeenCalledOnce();
    pick();
    const form = screen.getByRole("form", { name: "Tell us about your project" });
    expect(within(form).getByText("Optional")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Why we ask this" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel setup" })).toBeNull();
    progress("Project details");
    for (const [label, value] of project) await select(label, value);
    click("Continue");
    progress("Organization details");
    expect(screen.queryByRole("button", { name: "Cancel setup" })).toBeNull();
    change("Organization name", "Acme Labs");
    expect(input("Slug").value).toBe("acme-labs");
    change("Organization name", "Acme Cloud");
    expect(input("Slug").value).toBe("acme-cloud");
    change("Slug", "  custom-org  ");
    change("Organization name", "  Final Org  ");
    expect(input("Slug").value).toBe("  custom-org  ");
    await select("Data region", "Europe (Ireland)");
    revealLogoUrl();
    change("Logo URL", logo);
    expect(input("Logo URL").checkValidity()).toBe(true);
    click("Back");
    progress("Project details");
    click("Back");
    pick();
    for (const [label, value] of project) {
      expect(screen.getByRole("combobox", { name: label }).textContent).toContain(value);
    }
    click("Continue");
    progress("Organization details");
    expect(input("Organization name").value).toBe("  Final Org  ");
    expect(input("Slug").value).toBe("  custom-org  ");
    expect(screen.getByRole("combobox", { name: "Data region" }).textContent).toContain("Ireland");
    revealLogoUrl();
    expect(input("Logo URL").value).toBe(logo);
    expect(screen.getByRole("img", { name: "Logo preview" }).getAttribute("src")).toBe(logo);
    expect(api).not.toHaveBeenCalled();
    // Submit directly to exercise handler trimming independently of the native slug pattern.
    fireEvent.submit(details());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledExactlyOnceWith("/v1/tenants", {
      method: "POST",
      body: {
        name: "Final Org",
        slug: "custom-org",
        plan: "free",
        region: "eu-west-1",
        logo_url: logo,
      },
    });
    expect(readStashedProfile()).toEqual({
      use_case: "b2b_saas",
      team_size: "2-10",
      role: "engineer",
      logo_url: logo,
    });
    expect(startSignupCheckout).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  }, 20_000);

  it.each([
    ["Free", "Continue", "free"],
    ["Starter", "Skip for now", "starter_year"],
    ["Pro", "Continue", "pro_year"],
  ] as const)("%s: empty profile, billing and busy guards", async (tier, action, planCode) => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.mocked(api).mockReturnValueOnce(pending.then(() => created));
    // An active checkout completes without handing jsdom a redirect.
    vi.mocked(startSignupCheckout).mockReturnValueOnce(pending.then(() => ({ status: "active" })));
    mount(<CreateOrgFlow onDone={onDone} planStacked showGuidance />);
    expect(screen.queryByRole("button", { name: "Cancel setup" })).toBeNull();
    click(/^Yearly/);
    await select("Currency", "USD ($)");
    pick(tier);
    expect(screen.queryByRole("complementary")).toBeNull();
    click(action);
    change("Organization name", "  Pending Org  ");
    click("Change plan");
    expect(screen.getByRole("button", { name: /^Yearly/, pressed: true })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Currency" }).textContent).toContain("USD ($)");
    pick(tier);
    click(action);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(input("Organization name").value).toBe("  Pending Org  ");
    const form = details();
    click(tier === "Free" ? "Create organization" : "Continue to payment");
    await waitFor(() => expect(form.getAttribute("aria-busy")).toBe("true"));
    for (const control of form.querySelectorAll("input:not([type=hidden]), button")) {
      expect(control.matches(":disabled")).toBe(true);
    }
    click("Back");
    click("Change plan");
    click("Setting up…");
    fireEvent.submit(form);
    expect(onDone).not.toHaveBeenCalled();
    expect(tier === "Free" ? api : startSignupCheckout).toHaveBeenCalledOnce();
    await act(async () => finish());
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    if (tier === "Free") {
      expect(api).toHaveBeenCalledExactlyOnceWith("/v1/tenants", {
        method: "POST",
        body: {
          name: "Pending Org",
          slug: "pending-org",
          plan: "free",
          region: "ap-south-1",
          logo_url: undefined,
        },
      });
      expect(startSignupCheckout).not.toHaveBeenCalled();
    } else {
      expect(startSignupCheckout).toHaveBeenCalledExactlyOnceWith({
        orgName: "Pending Org",
        orgSlug: "pending-org",
        region: "ap-south-1",
        planCode,
        currency: "USD",
        country: "US",
        successUrl: `${window.location.origin}/?checkout=success`,
        cancelUrl: `${window.location.origin}/?checkout=cancelled`,
      });
      expect(api).not.toHaveBeenCalled();
    }
    expect(readStashedProfile()).toEqual({});
  });

  it.each([
    ["Free", 422, "Some of the details entered aren't valid. Please review and try again."],
    ["Free", 500, "Something went wrong. Please try again."],
    ["Pro", 403, "You don't have access to do that."],
  ] as const)("curates %s HTTP %s errors", async (tier, status, copy) => {
    const error = new ApiError(
      status,
      "test.failure",
      "private backend message",
      "private database detail",
    );
    vi.mocked(tier === "Free" ? api : startSignupCheckout).mockRejectedValueOnce(error);
    mount();
    pick(tier);
    click("Skip for now");
    change("Organization name", "Failed Org");
    click(tier === "Free" ? "Create organization" : "Continue to payment");
    expect((await screen.findByRole("alert")).textContent).toBe(copy);
    expect(document.body.textContent).not.toContain(error.message);
    expect(document.body.textContent).not.toContain(error.detail);
    expect(details().getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("button", { name: "Back" }).matches(":disabled")).toBe(false);
    expect(tier === "Free" ? api : startSignupCheckout).toHaveBeenCalledOnce();
    expect(tier === "Free" ? startSignupCheckout : api).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  // Reusing an existing org's name auto-derives that org's slug (the slug field
  // mirrors the name until edited), so this is the collision users actually hit.
  // Both paths reach it: Free inserts directly, paid pre-checks before charging.
  it.each(["Free", "Pro"] as const)("names the taken org URL on the %s path", async (tier) => {
    const error = new ApiError(409, "tenant.slug_taken", "slug taken", "uq_tenants_slug");
    vi.mocked(tier === "Free" ? api : startSignupCheckout).mockRejectedValueOnce(error);
    mount();
    pick(tier);
    click("Skip for now");
    change("Organization name", "Existing Org");
    click(tier === "Free" ? "Create organization" : "Continue to payment");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "That organization URL is already taken. Choose a different URL — your organization name can stay the same.",
    );
    expect(alert.textContent).not.toMatch(/something went wrong/i);
    expect(document.body.textContent).not.toContain(error.detail);
    // Recoverable in place: the form stays usable so the slug can be corrected.
    expect(details().getAttribute("aria-busy")).toBe("false");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("previews a valid uploaded logo and allows it to be removed without submitting", async () => {
    mount();
    pick();
    click("Skip for now");
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'],
      "logo.svg",
      { type: "image/svg+xml" },
    );
    const upload = screen.getByLabelText<HTMLInputElement>("Upload a logo file");
    fireEvent.change(upload, { target: { files: [file] } });
    const image = await screen.findByRole("img", { name: "Logo preview" });
    expect(image.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(screen.getByText("Uploaded file (preview)")).toBeTruthy();
    click("Remove");
    expect(screen.queryByRole("img", { name: "Logo preview" })).toBeNull();
    revealLogoUrl();
    expect(input("Logo URL").value).toBe("");
    expect(api).not.toHaveBeenCalled();
  });

  it.each([
    ["text/plain", 10, "That doesn't look like an image file."],
    ["image/png", 2 * 1024 * 1024 + 1, "File is larger than 2 MB."],
  ] as const)("rejects %s uploads of %s bytes inline", (type, size, copy) => {
    mount();
    pick();
    click("Skip for now");
    const file = new File([new Uint8Array(size)], "logo", { type });
    fireEvent.change(screen.getByLabelText("Upload a logo file"), { target: { files: [file] } });
    expect(screen.getByRole("alert").textContent).toBe(copy);
    revealLogoUrl();
    expect(input("Logo URL").value).toBe("");
    expect(screen.queryByRole("img", { name: "Logo preview" })).toBeNull();
    expect(api).not.toHaveBeenCalled();
    expect(startSignupCheckout).not.toHaveBeenCalled();
  });
});
