// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null, canRead: true }));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/modules/dashboard", () => ({ PageBreadcrumb: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => context.tenantId,
  useMe: () => ({
    data: { email: "operator@example.test", email_verified_at: "2026-09-01T00:00:00Z" },
  }),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => context.canRead }),
}));
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string }[]);
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (options: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(options);
        return run(options);
      };
    },
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { EmailTemplate } from "../api/email-templates";
import {
  EmailTemplatesPage,
  EmailTemplatesView,
  type EmailTemplatesViewProps,
} from "../components/emails/email-templates-page";

import {
  emailDraftErrors,
  emailHTMLText,
  emailLocaleContent,
  emailPreviewDocument,
  emailTemplateInput,
  previewEmailDraft,
  unknownEmailVariables,
  updateEmailLocale,
  validEmailTemplateLink,
} from "../email-template-model";

function templateAt(index: number): EmailTemplate {
  const template = templates()[index];
  assert(template, `no email template fixture at ${index}`);
  return template;
}

function templates(): EmailTemplate[] {
  return [
    {
      key: "verify_email",
      name: "Email verification",
      description: "Sent when a user verifies their email.",
      subject: "Verify your email",
      body: "Your verification code is {{code}}. It expires in {{ttl}}.",
      variables: ["code", "ttl"],
    },
    {
      key: "password_reset",
      name: "Password reset",
      description: "Sent when a user resets their password.",
      subject: "Reset your password",
      body: "Reset link: {{reset_url}}",
      variables: ["reset_url"],
    },
    {
      key: "magic_link",
      name: "Magic link",
      description: "Passwordless sign-in link.",
      subject: "Sign in",
      body: "{{magic_url}}",
      variables: ["magic_url"],
    },
    {
      key: "invite",
      name: "Invitation",
      description: "Organization invitation.",
      subject: "Join {{tenant_name}}",
      body: "{{invite_url}}",
      variables: ["tenant_name", "invite_url"],
    },
    {
      key: "mfa_otp",
      name: "MFA one-time passcode",
      description: "Second-factor verification.",
      subject: "Your code",
      body: "{{code}} expires in {{ttl}}",
      variables: ["code", "ttl"],
    },
  ].map((item) => ({ ...item, custom: false, options: {} }));
}

function viewProps(): EmailTemplatesViewProps {
  return {
    name: "Acme",
    templates: templates(),
    capabilities: { rich_text: true, localization: true, test_email: true },
    brand: { name: "Qeet ID", primary: "#f97316" },
    recipient: "operator@example.test",
    canRead: true,
    canWrite: true,
    loading: false,
    error: null,
    fetching: false,
    onRetry: vi.fn(),
    onSave: vi.fn(async (key, draft) => ({
      ...templateFixture(key),
      ...draft,
      custom: true,
    })),
    onReset: vi.fn(async (template) => templateFixture(template.key)),
    onTest: vi.fn(async () => ({ status: "accepted" as const })),
  };
}

function templateFixture(key: string) {
  const template = templates().find((item) => item.key === key);
  if (!template) throw new Error("Template fixture not found");
  return template;
}

// jsdom lays nothing out: ProseMirror measures a Range to scroll the caret into view.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

beforeEach(() => {
  context.tenantId = "tenant-a";
  context.canRead = true;
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (/^\/v1\/tenants\/[^/]+$/.test(path)) return { id: context.tenantId, name: "Acme" };
    if (path.endsWith("/branding"))
      return { tenant_id: context.tenantId, primary_color: "#f97316", email_from_name: "Qeet ID" };
    if (path.endsWith("/email-templates"))
      return { items: templates(), capabilities: viewProps().capabilities };
    if (path.endsWith("/test")) return { status: "accepted" };
    const template = templates().find((item) => path.endsWith(`/${item.key}`));
    if (template)
      return options?.method === "PUT"
        ? { ...template, ...(options.body as object), custom: true }
        : template;
    throw new Error("Unexpected request");
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <EmailTemplatesPage />
      </SensitiveActionProvider>
    </QueryClientProvider>
  );
  return { ...render(tree()), tree, client };
}

// The library Button disables with aria-disabled, so it stays focusable.
const isDisabled = (element: HTMLElement) =>
  element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
const saveButton = () => screen.getByRole("button", { name: "Save template" });
const subject = () => screen.getByLabelText(/^Subject/) as HTMLInputElement;
const frame = () => screen.getByTitle("Email verification email preview");

describe("Email template draft preview", () => {
  it("requires the action URL in both email alternatives", () => {
    const draft = emailTemplateInput(templateAt(2));
    expect(emailDraftErrors({ ...draft, body: "No link" }, ["magic_url"])).toContain("actionLink");
    expect(
      emailDraftErrors({ ...draft, options: { ...draft.options, body_html: "<p>No link</p>" } }, [
        "magic_url",
      ]),
    ).toContain("actionLink");
  });

  it("keeps supported template links in rich HTML and its text alternative", () => {
    const html = '<p><a href="{{magic_url}}">Sign in</a></p>';
    expect(emailHTMLText(html)).toContain("{{magic_url}}");
    expect(validEmailTemplateLink("{{magic_url}}", ["magic_url"])).toBe(true);
    expect(validEmailTemplateLink("{{unknown_url}}", ["magic_url"])).toBe(false);
    const draft = emailTemplateInput(templateAt(2));
    draft.options.body_html = html;
    expect(emailPreviewDocument(draft, "en", ["magic_url"], { name: "Qeet ID" })).toContain(
      'href="https://example.invalid/test/preview"',
    );
  });

  it("sanitizes rich markup and keeps the preview sandbox document brand-colored", () => {
    const draft = emailTemplateInput(templateAt(0));
    draft.options.body_html =
      '<p onclick="steal()">{{code}}</p><script>steal()</script><a href="javascript:steal()">Bad</a>';
    const html = emailPreviewDocument(draft, "en", ["code", "ttl"], {
      name: "Qeet <Team>",
      primary: "#f97316",
    });
    expect(html).toContain("#f97316");
    expect(html).toContain("482913");
    expect(html).toContain("Qeet &lt;Team&gt;");
    expect(html).not.toMatch(/<script|onclick=|javascript:/);
    expect(html).toContain("default-src 'none'");
  });

  it("keeps each locale separate and validates every saved language", () => {
    const base = emailTemplateInput(templateAt(0));
    const translated = updateEmailLocale(base, "fr", {
      subject: "Votre code",
      body: "Code {{code}}",
      preheader: "Bonjour",
    });
    expect(emailLocaleContent(translated, "en").subject).toBe("Verify your email");
    expect(emailLocaleContent(translated, "fr").subject).toBe("Votre code");
    expect(emailDraftErrors(translated, ["code", "ttl"])).toEqual([]);
    expect(
      emailDraftErrors(updateEmailLocale(translated, "fr", { body: "{{unknown}}" }), [
        "code",
        "ttl",
      ]),
    ).toContain("variables");
  });
  it("previews current edits with the backend's variable syntax", () => {
    const draft = {
      subject: "Welcome to {{ tenant_name }}",
      body: "Your new code is {{code}}. It expires in {{ttl}}.",
    };
    expect(
      previewEmailDraft(draft, { tenant_name: "Qeet Group", code: "482913", ttl: "10 minutes" }),
    ).toEqual({
      subject: "Welcome to Qeet Group",
      body: "Your new code is 482913. It expires in 10 minutes.",
    });
    expect(draft.subject).toBe("Welcome to {{ tenant_name }}");
  });

  it("substitutes values literally and leaves missing variables visible", () => {
    expect(
      previewEmailDraft(
        { subject: "{{code}}", body: "{{unknown}} {{constructor}}" },
        { code: "$& $1" },
      ),
    ).toEqual({ subject: "$& $1", body: "{{unknown}} {{constructor}}" });
    expect(
      unknownEmailVariables(
        { subject: "{{name}}", body: "{{code}} {{name}} {{verification_link}}" },
        ["code", "ttl"],
      ),
    ).toEqual(["name", "verification_link"]);
  });
});

describe("Emails workspace", () => {
  it("lists the templates beside one ruled editor with four tabs and a sandboxed preview", async () => {
    const { container } = render(<EmailTemplatesView {...viewProps()} />);
    expect(screen.getByRole("heading", { name: "Emails", level: 1 })).toBeTruthy();
    const list = screen.getByRole("navigation", { name: "Email templates" });
    expect(list.querySelectorAll(".mail-list button")).toHaveLength(5);
    // The catalogue's developer wording is the console's own.
    expect(within(list).getAllByText("Two-step code").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Content",
      "Design",
      "Languages",
      "Advanced",
    ]);
    await screen.findByRole("textbox", { name: "Body" });
    expect(frame().getAttribute("sandbox")).toBe("");
    expect(frame().getAttribute("srcdoc")).toContain("#f97316");
    expect(isDisabled(saveButton())).toBe(true);
    expect(container.querySelector("[class*='bg-'], [class*='text-muted']")).toBeNull();
  });

  it("previews unsaved subject and preheader edits immediately and saves them", async () => {
    const props = viewProps();
    render(<EmailTemplatesView {...props} />);
    fireEvent.change(subject(), { target: { value: "Updated {{code}}" } });
    fireEvent.change(screen.getByLabelText(/^Preheader/), {
      target: { value: "Expires in {{ttl}}" },
    });
    await waitFor(() => expect(frame().getAttribute("srcdoc")).toContain("Updated 482913"));
    expect(frame().getAttribute("srcdoc")).toContain("Expires in 10 minutes");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(saveButton());
    await screen.findByText("Template saved.");
    expect(props.onSave).toHaveBeenCalledWith(
      "verify_email",
      expect.objectContaining({
        subject: "Updated {{code}}",
        options: expect.objectContaining({ preheader: "Expires in {{ttl}}" }),
      }),
    );
    expect(isDisabled(saveButton())).toBe(true);
  });

  it("retains per-template drafts while navigating and preserves edits across a refetch", () => {
    const props = viewProps();
    const view = render(<EmailTemplatesView {...props} />);
    fireEvent.change(subject(), { target: { value: "Unsaved subject" } });
    const list = screen.getByRole("navigation", { name: "Email templates" });
    expect(within(list).getByText("Unsaved")).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: /Password reset/ }));
    fireEvent.click(within(list).getByRole("button", { name: /Email verification/ }));
    expect(subject().value).toBe("Unsaved subject");
    view.rerender(
      <EmailTemplatesView
        {...props}
        templates={templates().map((item) => ({ ...item, subject: "Changed server subject" }))}
      />,
    );
    expect(subject().value).toBe("Unsaved subject");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(subject().value).toBe("Changed server subject");
  });

  it("inserts only valid variables into the focused subject field", async () => {
    render(<EmailTemplatesView {...viewProps()} />);
    fireEvent.focus(subject());
    subject().setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole("button", { name: "Insert variable" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /\{\{code\}\}/ }));
    expect(subject().value).toBe("{{code}}Verify your email");
    expect(screen.queryByRole("menuitem", { name: /\{\{name\}\}/ })).toBeNull();
  });

  it("formats body content with the real rich-text editor", async () => {
    render(<EmailTemplatesView {...viewProps()} />);
    const body = await screen.findByRole("textbox", { name: "Body" });
    expect(body.getAttribute("contenteditable")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Address" }), {
      target: { value: "javascript:alert(1)" },
    });
    expect(isDisabled(within(dialog).getByRole("button", { name: "Insert" }))).toBe(true);
  });

  it("changes the header's alignment without touching the organisation's brand colour", () => {
    render(<EmailTemplatesView {...viewProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Left" }));
    expect(frame().getAttribute("srcdoc")).toContain("text-align:left");
    expect(screen.getByText("#f97316")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: "Change in Branding" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/settings/branding",
      "/settings/branding",
    ]);
    // Branding has no logo, so the name shows: emails can't send an uploaded one either.
    expect(screen.getByText("Branding has no logo yet, so the name shows instead.")).toBeTruthy();
  });

  it("adds a language as a copy of English and makes it the default", async () => {
    const props = viewProps();
    render(<EmailTemplatesView {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Languages" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(subject().value).toBe("Verify your email"));
    fireEvent.change(subject(), { target: { value: "Bestätigen Sie Ihre E-Mail" } });
    fireEvent.click(screen.getByRole("tab", { name: "Languages" }));
    fireEvent.click(screen.getByRole("button", { name: "Make default: German" }));
    fireEvent.click(saveButton());
    await screen.findByText("Template saved.");
    expect(props.onSave).toHaveBeenCalledWith(
      "verify_email",
      expect.objectContaining({
        subject: "Verify your email",
        options: expect.objectContaining({
          default_locale: "de",
          translations: expect.objectContaining({
            de: expect.objectContaining({ subject: "Bestätigen Sie Ihre E-Mail" }),
          }),
        }),
      }),
    );
  });

  it("shows the inbox line and where the links go, since the preview's links are inert", () => {
    render(<EmailTemplatesView {...viewProps()} />);
    expect(screen.getAllByText("Qeet ID").length).toBeGreaterThan(0);
    expect(screen.getByText(/No preheader: inboxes show the first line/)).toBeTruthy();
    expect(screen.getAllByText("Links in this email").length).toBeGreaterThan(0);
  });

  it("narrows the preview and opens all previews without dirtying the template", () => {
    render(<EmailTemplatesView {...viewProps()} />);
    expect(frame().dataset.mode).toBe("desktop");
    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
    expect(frame().dataset.mode).toBe("mobile");
    expect(isDisabled(saveButton())).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Preview all" }));
    expect(screen.getByRole("dialog").querySelectorAll("iframe")).toHaveLength(5);
  });

  it("blocks invalid variables and unsafe subject headers before save or test", () => {
    const props = viewProps();
    render(<EmailTemplatesView {...props} />);
    fireEvent.change(subject(), { target: { value: "{{unsupported}}" } });
    expect(screen.getByRole("alert").textContent).toContain("Use only this template's variables");
    fireEvent.click(saveButton());
    expect(props.onSave).not.toHaveBeenCalled();
    expect(isDisabled(screen.getByRole("button", { name: "Send test" }))).toBe(true);
  });

  it("keeps Send test focusable, with its reason, without a verified recipient", () => {
    render(<EmailTemplatesView {...viewProps()} recipient={undefined} />);
    const button = screen.getByRole("button", { name: "Send test" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("handles pending saves and errors without discarding the draft or leaking server details", async () => {
    const props = viewProps();
    let reject: (error: Error) => void = () => {};
    props.onSave = vi.fn(
      () =>
        new Promise<EmailTemplate>((_, fail) => {
          reject = fail;
        }),
    );
    render(<EmailTemplatesView {...props} />);
    fireEvent.change(subject(), { target: { value: "My draft" } });
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    expect(props.onSave).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("private database URL")));
    expect(screen.queryByText("private database URL")).toBeNull();
    expect(subject().value).toBe("My draft");
  });

  it("shows error and denied states without exposing cached template content", () => {
    const props = viewProps();
    const view = render(<EmailTemplatesView {...props} error={new Error("private")} />);
    expect(screen.queryByText("Email verification")).toBeNull();
    expect(screen.queryByText("private")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalled();
    view.rerender(<EmailTemplatesView {...props} canRead={false} />);
    expect(screen.queryByLabelText(/^Subject/)).toBeNull();
    expect(screen.getByText("You don't have access to email templates.")).toBeTruthy();
  });

  it("keeps test sending disabled when no email provider is configured", () => {
    render(
      <EmailTemplatesView
        {...viewProps()}
        capabilities={{ rich_text: true, localization: true, test_email: false }}
      />,
    );
    expect(isDisabled(screen.getByRole("button", { name: "Send test" }))).toBe(true);
  });
});

describe("Email template API actions", () => {
  it("confirms reset, saying what happens, and restores the server default to the editor", async () => {
    const fixtureAPI = vi.mocked(api).getMockImplementation();
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path.endsWith("/email-templates"))
        return {
          items: templates().map((item) =>
            item.key === "verify_email"
              ? { ...item, subject: "Saved custom subject", custom: true }
              : item,
          ),
          capabilities: viewProps().capabilities,
        };
      return fixtureAPI?.(path, options);
    });
    renderPage();
    await screen.findByDisplayValue("Saved custom subject");
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Its saved text, design and translations are removed");
    expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(
      false,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset to default" }));
    await screen.findByText("Template reset to the default.");
    expect(subject().value).toBe("Verify your email");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/email-templates/verify_email", {
      method: "DELETE",
    });
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Reset to default");
  });

  it("does not allow read-only editing or test sending", async () => {
    const props = viewProps();
    render(<EmailTemplatesView {...props} canWrite={false} />);
    expect(subject().disabled).toBe(true);
    expect(
      (await screen.findByRole("textbox", { name: "Body" })).getAttribute("contenteditable"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect(props.onTest).not.toHaveBeenCalled();
  });

  it("confirms test mail and submits the current draft to the active organisation only", async () => {
    renderPage();
    await screen.findByLabelText(/^Subject/);
    fireEvent.change(subject(), { target: { value: "Current draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("operator@example.test");
    expect(vi.mocked(api).mock.calls.some(([path]) => path.endsWith("/test"))).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Send test email" }));
    await screen.findByText("Test email handed to the mail provider.");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/email-templates/verify_email/test", {
      method: "POST",
      body: { draft: expect.objectContaining({ subject: "Current draft" }), locale: "en" },
    });
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Send test");
  });

  it("cancels a delayed test confirmation after the organisation changes", async () => {
    const view = renderPage();
    await screen.findByLabelText(/^Subject/);
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    await screen.findByRole("alertdialog");
    context.tenantId = "tenant-b";
    view.rerender(view.tree());
    await waitFor(() => expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-b/email-templates"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Send test email" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(vi.mocked(api).mock.calls.some(([path]) => path.endsWith("/test"))).toBe(false);
  });

  it("does not request template data when permission is denied", () => {
    context.canRead = false;
    renderPage();
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText("You don't have access to email templates.")).toBeTruthy();
  });
});
