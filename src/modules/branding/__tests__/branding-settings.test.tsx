// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  canRead: true,
  canWrite: true,
  canReadDomains: false,
  canReadBilling: false,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (permission: string) =>
      ({
        "tenant.read": context.canRead,
        "branding.write": context.canWrite,
        "connection.read": context.canReadDomains,
        "billing.read": context.canReadBilling,
      })[permission] ?? false,
  }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

import {
  type Branding,
  brandingContrast,
  brandingDraft,
  brandingForeground,
  brandingInput,
  normalizeBrandColor,
  validateBranding,
} from "../branding-model";
import {
  BrandingSettingsPage,
  BrandingSettingsView,
  type BrandingSettingsViewProps,
} from "../components/branding-settings-page";

beforeEach(() => {
  Object.assign(context, {
    tenantId: "tenant-a",
    canRead: true,
    canWrite: true,
    canReadDomains: false,
    canReadBilling: false,
  });
  vi.mocked(api).mockReset();
  let stored = { ...brandingFixture(), logo_url: "" };
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path.endsWith("/branding")) {
      if (options?.method === "PUT") stored = options.body as typeof stored;
      return {
        ...stored,
        tenant_id: context.tenantId,
        email_from_name: path.includes("tenant-b") ? "Second organization" : stored.email_from_name,
      };
    }
    if (path.endsWith("/entitlements"))
      return { plan: "pro", features: { custom_branding: true }, limits: {} };
    if (path.endsWith("/domains")) return { items: [] };
    throw new Error(`Unexpected mocked request ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

function viewProps(): BrandingSettingsViewProps {
  return {
    branding: { ...brandingFixture(), logo_url: "" },
    domains: [],
    domainsState: "ready",
    loading: false,
    error: false,
    fetching: false,
    canRead: true,
    canWrite: true,
    canManageDomains: false,
    canManageBilling: false,
    entitled: true,
    onRetry: vi.fn(),
    onSave: vi.fn().mockImplementation(async (branding) => branding),
  };
}

function renderPage(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  const tree = () => (
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <BrandingSettingsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>
  );
  return { ...render(tree()), client, tree };
}

function brandingFixture(): Branding {
  return {
    tenant_id: "tenant-a",
    logo_url: "https://example.test/logo.png",
    primary_color: "#f97316",
    secondary_color: "#8b5cf6",
    custom_domain: "auth.example.test",
    email_from_name: "Example Auth",
    email_from_address: "auth@example.test",
    settings: { custom_footer: "Existing footer", security: { require_mfa: true } },
  };
}

describe("Branding draft", () => {
  it("persists independent background and reply-to without losing other settings", () => {
    const original = brandingFixture();
    const draft = {
      ...brandingDraft(original),
      background_color: "#F4F4F5",
      email_reply_to: " support@example.test ",
    };
    expect(brandingInput(draft, original)).toMatchObject({
      secondary_color: "#8b5cf6",
      settings: {
        ...original.settings,
        background_color: "#f4f4f5",
        email_reply_to: "support@example.test",
      },
    });
    expect(
      validateBranding({ ...draft, email_reply_to: "invalid", background_color: "red" }),
    ).toMatchObject({ email_reply_to: "email", background_color: "color" });
  });

  it("chooses readable preview text using WCAG contrast", () => {
    for (const color of ["#f97316", "#8b5cf6", "#ffffff", "#111827", "#22c55e", "#777777"]) {
      expect(brandingContrast(color, brandingForeground(color))).toBeGreaterThanOrEqual(4.5);
    }
    expect(brandingForeground("#f97316")).toBe("#0a0a0a");
    expect(brandingContrast("#ffffff", "#000000")).toBe(21);
  });

  it("retains existing branding and unrelated settings while normalizing edits", () => {
    const original = brandingFixture();
    const draft = {
      ...brandingDraft(original),
      primary_color: " #F93 ",
      custom_domain: " Auth.Example.Test ",
      email_from_name: " Updated Auth ",
    };
    expect(validateBranding(draft)).toEqual({});
    expect(brandingInput(draft, original)).toEqual({
      ...original,
      primary_color: "#ff9933",
      email_from_name: "Updated Auth",
    });
    expect(original.email_from_name).toBe("Example Auth");
  });

  it("hydrates nullable fields and keeps the accent independent of a background", () => {
    const draft = brandingDraft({
      tenant_id: "tenant-a",
      logo_url: null,
      primary_color: null,
      secondary_color: null,
    });
    expect(draft).toMatchObject({
      logo_url: "",
      primary_color: "#f97316",
      secondary_color: "#8b5cf6",
    });
    expect(normalizeBrandColor("#ABC")).toBe("#aabbcc");
    expect(normalizeBrandColor("url(https://example.test)")).toBeNull();
  });

  it("rejects invalid colors, unsafe logo URLs, non-hostnames and header injection", () => {
    const draft = {
      ...brandingDraft(brandingFixture()),
      primary_color: "red",
      secondary_color: "#12345678",
      logo_url: "javascript:alert(1)",
      custom_domain: "https://auth.example.test/path",
      email_from_address: "not-an-email",
      email_from_name: "Name\r\nBcc: other@example.test",
    };
    expect(validateBranding(draft)).toEqual({
      primary_color: "color",
      secondary_color: "color",
      logo_url: "logo",
      custom_domain: "domain",
      email_from_address: "email",
      email_from_name: "header",
    });
  });
});

describe("Branding workspace", () => {
  it("does not overwrite newer fields when a logo file finishes reading", () => {
    let reader: FileReader | undefined;
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      reader = this;
    });
    render(<BrandingSettingsView {...viewProps()} />);
    fireEvent.change(screen.getByLabelText("Upload a logo file"), {
      target: { files: [new File(["image"], "logo.png", { type: "image/png" })] },
    });
    fireEvent.change(screen.getByLabelText("From name"), {
      target: { value: "Latest sender edit" },
    });
    if (!reader) throw new Error("Logo reader was not started");
    const pendingReader = reader;
    act(() => {
      Object.defineProperty(pendingReader, "result", { value: "data:image/png;base64,aW1hZ2U=" });
      pendingReader.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
    });
    expect((screen.getByLabelText("From name") as HTMLInputElement).value).toBe(
      "Latest sender edit",
    );
    expect(screen.getByAltText("Logo preview").getAttribute("src")).toBe(
      "data:image/png;base64,aW1hZ2U=",
    );
  });

  it("uses reported TLS state only for the matching saved login domain", () => {
    render(
      <BrandingSettingsView
        {...viewProps()}
        loginDomain={{
          login_domain: "auth.example.test",
          status: "active",
          dns_verified: true,
          dns_detail: "",
          tls_state: "issued",
          tls_detail: "",
          endpoint_state: "live",
          endpoint_url: "https://auth.example.test",
          records: [],
        }}
      />,
    );
    expect(screen.getByText("TLS certificate: issued")).toBeTruthy();
    expect(screen.getByText("Login endpoint: live")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Login domain"), {
      target: { value: "new.example.test" },
    });
    expect(screen.queryByText("TLS certificate: issued")).toBeNull();
    expect(screen.getByText("TLS certificate: not reported")).toBeTruthy();
  });

  it.each(["light", "dark"])("keeps the same branding controls in %s mode", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const { container } = render(<BrandingSettingsView {...viewProps()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Branding" })).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Brand identity",
      "Brand colors",
      "Custom domain",
      "Outgoing email identity",
      "Hosted login preview",
      "Where your brand appears",
    ]);
    expect(screen.getByRole("form", { name: "Organization branding" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByText("No unsaved changes")).toBeTruthy();
    expect(screen.queryByText("TLS certificate active")).toBeNull();
    expect(screen.getByText("Ownership not verified")).toBeTruthy();
    for (const element of container.querySelectorAll("[class]"))
      expect(element.getAttribute("class")).not.toMatch(
        /\bdark:(hidden|block|grid|flex|order-|p[xy]-|m[xy]-)/,
      );
  });

  it("updates all three colors and reply-to, preserving settings and clearing dirty state", async () => {
    const props = viewProps();
    render(<BrandingSettingsView {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Primary color" }), {
      target: { value: "#22c55e" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Background color" }), {
      target: { value: "#fafafa" },
    });
    fireEvent.change(screen.getByLabelText("Reply-to (optional)"), {
      target: { value: "support@example.test" },
    });
    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Branding changes saved");
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_color: "#22c55e",
        secondary_color: "#8b5cf6",
        settings: {
          ...brandingFixture().settings,
          background_color: "#fafafa",
          email_reply_to: "support@example.test",
        },
      }),
    );
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("preserves dirty edits on refresh and resets to the latest saved branding", () => {
    const props = viewProps();
    const view = render(<BrandingSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("From name"), { target: { value: "Unsaved name" } });
    view.rerender(
      <BrandingSettingsView
        {...props}
        branding={{
          ...brandingFixture(),
          logo_url: "",
          email_from_name: "Latest saved name",
          settings: { retained: true },
        }}
      />,
    );
    expect((screen.getByLabelText("From name") as HTMLInputElement).value).toBe("Unsaved name");
    fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
    expect((screen.getByLabelText("From name") as HTMLInputElement).value).toBe(
      "Latest saved name",
    );
    expect(screen.queryByText("You have unsaved changes")).toBeNull();
  });

  it("rejects invalid fields and does not submit them", () => {
    const props = viewProps();
    render(<BrandingSettingsView {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Primary color" }), {
      target: { value: "invalid" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Primary color" }));
    fireEvent.change(screen.getByLabelText("Login domain"), {
      target: { value: "https://auth.example.test/path" },
    });
    fireEvent.blur(screen.getByLabelText("Login domain"));
    expect(
      screen.getByRole("textbox", { name: "Primary color" }).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      screen.getByText("Enter a hostname without a protocol, port, path, or spaces."),
    ).toBeTruthy();
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("reflects swatches and preview size without changing persisted branding", () => {
    const props = viewProps();
    const { container } = render(<BrandingSettingsView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Set Primary color to #10b981" }));
    expect((screen.getByRole("textbox", { name: "Primary color" }) as HTMLInputElement).value).toBe(
      "#10b981",
    );
    expect(
      (container.querySelector("[data-preview-primary]") as HTMLElement).style.backgroundColor,
    ).toBe("rgb(16, 185, 129)");
    fireEvent.click(screen.getByRole("button", { name: "Mobile view" }));
    expect(container.querySelector('[data-preview-mode="mobile"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use automatic background" }));
    expect(
      (screen.getByRole("textbox", { name: "Background color" }) as HTMLInputElement).value,
    ).toBe("");
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("only shows ownership verified for the saved exact domain, never TLS verification", () => {
    const props = viewProps();
    render(
      <BrandingSettingsView
        {...props}
        domains={[
          {
            id: "domain-a",
            domain: "auth.example.test",
            verification_token: "fixture",
            dns_record_name: "_qeet.auth.example.test",
            dns_record_type: "TXT",
            dns_record_value: "fixture",
            verified_at: "2026-09-01T00:00:00Z",
            created_at: "2026-08-01T00:00:00Z",
            sso_enabled: false,
            jit_enabled: false,
            is_default: false,
            status: "verified",
          },
        ]}
      />,
    );
    expect(screen.getByText("Ownership verified")).toBeTruthy();
    expect(screen.getByText("TLS certificate: not reported")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Login domain"), {
      target: { value: "other.example.test" },
    });
    expect(screen.queryByText("Ownership verified")).toBeNull();
    expect(screen.getByText("Unsaved domain")).toBeTruthy();
  });

  it("shows domain data as unavailable when access or the query fails", () => {
    render(<BrandingSettingsView {...viewProps()} domainsState="error" />);
    expect(screen.getByText("Ownership not reported")).toBeTruthy();
    expect(screen.queryByText("Ownership not verified")).toBeNull();
  });

  it("shows loading, retry and read-only states without revealing denied data", () => {
    const props = viewProps();
    const view = render(<BrandingSettingsView {...props} loading />);
    expect(screen.getByRole("status", { name: "Loading branding" })).toBeTruthy();
    view.rerender(<BrandingSettingsView {...props} error />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("form")).toBeNull();
    view.rerender(<BrandingSettingsView {...props} canRead={false} />);
    expect(screen.queryByDisplayValue("Example Auth")).toBeNull();
    view.rerender(<BrandingSettingsView {...props} canWrite={false} />);
    expect(screen.getByLabelText("From name").matches(":disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("From name"), { target: { value: "Blocked" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("disables paid customization on a plan without branding", () => {
    render(<BrandingSettingsView {...viewProps()} canWrite={false} entitled={false} />);
    expect(screen.getByText("Custom branding requires Starter or a higher plan.")).toBeTruthy();
    expect(screen.getByLabelText("From name").matches(":disabled")).toBe(true);
  });

  it("retains edits after a safe save error and prevents duplicate requests", async () => {
    const props = viewProps();
    let rejectSave: (failure: Error) => void = () => {};
    props.onSave = vi.fn(
      () =>
        new Promise<Branding>((_, reject) => {
          rejectSave = reject;
        }),
    );
    render(<BrandingSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("From name"), { target: { value: "Edited name" } });
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("From name").matches(":disabled")).toBe(true);
    rejectSave(new Error("private backend connection string"));
    await screen.findByRole("alert");
    expect(screen.queryByText("private backend connection string")).toBeNull();
    expect((screen.getByLabelText("From name") as HTMLInputElement).value).toBe("Edited name");
  });

  it("shows logo readiness only after decoding and clears removed images", async () => {
    const props = viewProps();
    render(<BrandingSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("Or provide a logo URL"), {
      target: { value: "https://example.test/logo.png" },
    });
    expect(screen.queryByText("Logo ready")).toBeNull();
    fireEvent.load(screen.getByAltText("Logo preview"));
    expect(screen.getByText("Logo ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
    expect(screen.queryByAltText("Logo preview")).toBeNull();
    expect(screen.queryByText("Logo ready")).toBeNull();
  });

  it("rejects oversized/non-image uploads and blocks saving a broken logo", () => {
    const props = viewProps();
    render(<BrandingSettingsView {...props} />);
    const input = screen.getByLabelText("Upload a logo file");
    fireEvent.change(input, {
      target: { files: [new File(["hello"], "note.txt", { type: "text/plain" })] },
    });
    expect(screen.getByText("That doesn't look like an image file.")).toBeTruthy();
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" })],
      },
    });
    expect(screen.getByText("File is larger than 2 MB.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Or provide a logo URL"), {
      target: { value: "https://example.test/missing.png" },
    });
    fireEvent.error(screen.getByAltText("Logo preview"));
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).not.toHaveBeenCalled();
  });
});

describe("Branding authorization", () => {
  it("does not request or render cached branding when read access is denied", async () => {
    context.canRead = false;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["branding", "tenant-a"], brandingFixture());
    renderPage(client);
    await screen.findByText("You don't have access to branding settings.");
    expect(api).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("Example Auth")).toBeNull();
  });

  it("saves only to the active tenant through the branding API", async () => {
    renderPage();
    await screen.findByDisplayValue("Example Auth");
    fireEvent.change(screen.getByLabelText("Reply-to (optional)"), {
      target: { value: "reply@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Branding changes saved");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/branding", {
      method: "PUT",
      body: expect.objectContaining({
        tenant_id: "tenant-a",
        settings: expect.objectContaining({ email_reply_to: "reply@example.test" }),
      }),
    });
    expect(vi.mocked(api).mock.calls.some(([path]) => path.endsWith("/domains"))).toBe(false);
  });

  it("clears draft data when changing organization or losing write access", async () => {
    const view = renderPage();
    await screen.findByDisplayValue("Example Auth");
    fireEvent.change(screen.getByLabelText("From name"), { target: { value: "Private draft" } });
    context.tenantId = "tenant-b";
    view.rerender(view.tree());
    await screen.findByDisplayValue("Second organization");
    expect(screen.queryByDisplayValue("Private draft")).toBeNull();
    fireEvent.change(screen.getByLabelText("From name"), { target: { value: "Second draft" } });
    context.canWrite = false;
    view.rerender(view.tree());
    expect(screen.queryByDisplayValue("Second draft")).toBeNull();
    expect(screen.getByLabelText("From name").matches(":disabled")).toBe(true);
  });
});
