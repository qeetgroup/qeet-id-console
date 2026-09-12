// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  state: "ready",
  canRead: true,
  canWrite: true,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: context.state,
    can: (permission: string) =>
      permission === "secret.read" ? context.canRead : context.canWrite,
  }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { QEETAI_PROVIDER_CONFIG_KEY, type QeetAIProviderConfig } from "../api/qeetai";
import {
  ProviderSettingsView,
  type ProviderSettingsViewProps,
  QeetAISettingsPage,
} from "../components/provider-settings-page";

import {
  changeProvider,
  providerSettingsDraft,
  providerSettingsInput,
  validateProviderSettings,
} from "../provider-settings-model";

function savedConfig(): QeetAIProviderConfig {
  return {
    source: "tenant",
    provider: "anthropic",
    model: "claude-sonnet-5",
    max_tokens: 4096,
    last4: "test",
    platform_fallback: true,
  };
}

function viewProps(): ProviderSettingsViewProps {
  return {
    config: savedConfig(),
    loading: false,
    error: false,
    fetching: false,
    canRead: true,
    canWrite: true,
    onRetry: vi.fn(),
    onSave: vi.fn().mockResolvedValue(savedConfig()),
    onTest: vi.fn().mockResolvedValue({ ok: true }),
    onRemove: vi.fn().mockResolvedValue({ source: "none", platform_fallback: false }),
  };
}

beforeEach(() => {
  context.tenantId = "tenant-a";
  context.state = "ready";
  context.canRead = true;
  context.canWrite = true;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(savedConfig());
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe("Provider settings UI", () => {
  it.each(["light", "dark"])("keeps the same content and controls in %s mode", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const { container } = render(<ProviderSettingsView {...viewProps()} />);
    expect(screen.getByRole("heading", { name: "Qeet AI", level: 1 })).toBeTruthy();
    expect(screen.getByRole("form", { name: "AI provider configuration" })).toBeTruthy();
    for (const name of [
      "How it works",
      "Security & compliance",
      "Supported providers",
      "Usage & billing",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByText("Key saved")).toBeTruthy();
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.getByLabelText("API key").getAttribute("type")).toBe("password");
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Save key" }).hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Show entered API key" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByText(/Rotated by|Last updated|Bedrock|Gemini/)).toBeNull();
    for (const element of container.querySelectorAll("[class]")) {
      expect(element.getAttribute("class")).not.toMatch(
        /\bdark:(hidden|block|grid|flex|order-|p[xy]-|m[xy]-)/,
      );
    }
  });

  it("reveals only the entered key and clears it after saving", async () => {
    const props = viewProps();
    render(<ProviderSettingsView {...props} />);
    const key = screen.getByLabelText("API key") as HTMLInputElement;
    fireEvent.change(key, { target: { value: "  fixture-key  " } });
    fireEvent.click(screen.getByRole("button", { name: "Show entered API key" }));
    expect(key.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));
    await screen.findByText(/Provider settings saved/);
    expect(props.onSave).toHaveBeenCalledWith({
      provider: "anthropic",
      model: "claude-sonnet-5",
      api_key: "fixture-key",
      base_url: undefined,
      max_tokens: 4096,
    });
    expect(key.value).toBe("");
    expect(key.type).toBe("password");
    expect(props.onTest).not.toHaveBeenCalled();
  });

  it("shows field validation before invalid settings can be tested or saved", () => {
    const props = viewProps();
    render(<ProviderSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "fixture-key" } });
    const endpoint = screen.getByLabelText("Base URL (optional)");
    fireEvent.change(endpoint, { target: { value: "invalid-url" } });
    fireEvent.blur(endpoint);
    expect(screen.getByText(/Enter a complete HTTP or HTTPS URL/)).toBeTruthy();
    expect(endpoint.getAttribute("aria-invalid")).toBe("true");
    const tokens = screen.getByLabelText("Max output tokens (optional)");
    fireEvent.change(tokens, { target: { value: "1.5" } });
    fireEvent.blur(tokens);
    expect(screen.getByText(/Enter a whole number from 1 to 200,000/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Test connection" }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onTest).not.toHaveBeenCalled();
  });

  it.each([
    ["Model", "custom-model"],
    ["API key", "replacement-key"],
    ["Base URL (optional)", "https://gateway.example.test"],
    ["Max output tokens (optional)", "8192"],
  ])("invalidates connection-test success when %s changes", async (label, value) => {
    const props = viewProps();
    render(<ProviderSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await screen.findByText(/Connection test passed/);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.queryByText(/Connection test passed/)).toBeNull();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("clears provider-specific inputs when switching to Azure", async () => {
    render(<ProviderSettingsView {...viewProps()} />);
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "fixture-key" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Provider" }), { button: 0 });
    const option = await screen.findByRole("option", { name: "Azure / OpenAI-compatible" });
    fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
    fireEvent.click(option);
    await waitFor(() =>
      expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe(""),
    );
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Base URL (required)").hasAttribute("required")).toBe(true);
  });

  it("resets draft changes and does not overwrite dirty fields on a background refetch", () => {
    const props = viewProps();
    const { rerender } = render(<ProviderSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "custom-draft-model" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "fixture-key" } });
    rerender(
      <ProviderSettingsView {...props} config={{ ...savedConfig(), model: "remote-model" }} />,
    );
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("custom-draft-model");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("remote-model");
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it("does not claim success for a failed probe or display raw provider errors", async () => {
    const props = viewProps();
    vi.mocked(props.onTest)
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error("private-key=fixture-key"));
    render(<ProviderSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await screen.findByText(/The connection test did not succeed/);
    expect(screen.queryByText(/Connection test passed/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(props.onTest).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Test connection" }).hasAttribute("disabled")).toBe(
        false,
      ),
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/private-key/)).toBeNull();
  });

  it("blocks duplicate submissions and input changes during a request", async () => {
    let finish: (result: { ok: boolean }) => void = () => {};
    const props = viewProps();
    vi.mocked(props.onTest).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { container } = render(<ProviderSettingsView {...props} />);
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onTest).toHaveBeenCalledOnce();
    expect(props.onSave).not.toHaveBeenCalled();
    for (const element of container.querySelectorAll(
      'form input:not([type="hidden"]), form button',
    )) {
      expect(element.matches(":disabled")).toBe(true);
    }
    await act(async () => {
      finish({ ok: true });
    });
    expect(screen.getByText(/Connection test passed/)).toBeTruthy();
  });

  it("renders read-only, loading, failed and denied configuration states", () => {
    const props = viewProps();
    const { container, rerender } = render(<ProviderSettingsView {...props} canWrite={false} />);
    expect(screen.getByText(/read-only access/)).toBeTruthy();
    for (const input of container.querySelectorAll("form input"))
      expect(input.matches(":disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Provider actions" })).toBeNull();
    rerender(<ProviderSettingsView {...props} loading />);
    expect(screen.getByRole("status", { name: "Loading AI provider settings" })).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    rerender(<ProviderSettingsView {...props} error />);
    expect(screen.queryByText("Key saved")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    rerender(<ProviderSettingsView {...props} canRead={false} />);
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByText("Ends in test")).toBeNull();
  });

  it("uses real fallback metadata and clears key material after removal", async () => {
    const props = viewProps();
    render(
      <ProviderSettingsView {...props} config={{ ...savedConfig(), platform_fallback: false }} />,
    );
    expect(screen.getByText(/This deployment has no Qeet-managed fallback/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Provider actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove key" }));
    await screen.findByText(/provider key has been removed/);
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    expect(props.onRemove).toHaveBeenCalledOnce();
  });
});

describe("Provider settings integration", () => {
  function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <SensitiveActionProvider>{children}</SensitiveActionProvider>
      </QueryClientProvider>
    );
    return { ...render(<QeetAISettingsPage />, { wrapper }), client };
  }

  it("uses tenant-scoped metadata and never stores the typed key in query or mutation caches", async () => {
    const { client } = renderPage();
    const key = await screen.findByLabelText("API key");
    fireEvent.change(key, { target: { value: "fixture-key-not-for-cache" } });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));
    await screen.findByText(/Provider settings saved/);
    expect(api).toHaveBeenCalledWith(
      "/v1/qeetai/provider-config",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({ api_key: "fixture-key-not-for-cache" }),
      }),
    );
    expect(client.getQueryData([...QEETAI_PROVIDER_CONFIG_KEY, "tenant-a"])).toEqual(savedConfig());
    const cachedData = client
      .getQueryCache()
      .getAll()
      .map((query) => query.state.data);
    expect(JSON.stringify(cachedData)).not.toContain("fixture-key-not-for-cache");
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it("requires confirmation before key removal and supports cancellation", async () => {
    renderPage();
    await screen.findByLabelText("API key");
    fireEvent.click(screen.getByRole("button", { name: "Provider actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove key" }));
    const removeButton = await screen.findByRole("button", { name: "Remove key" });
    const confirm = removeButton.closest('[role="dialog"], [role="alertdialog"]');
    if (!confirm) throw new Error("Removal confirmation is missing");
    expect(within(confirm as HTMLElement).getByText(/Qeet-managed provider/)).toBeTruthy();
    expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(
      false,
    );
    fireEvent.click(within(confirm as HTMLElement).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove key" })).toBeNull());
    expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(
      false,
    );
  });

  it("clears draft credentials on organization switches and permission revocation", async () => {
    const { rerender } = renderPage();
    fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "fixture-key" } });
    context.tenantId = "tenant-b";
    rerender(<QeetAISettingsPage />);
    await screen.findByLabelText("API key");
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "other-fixture-key" } });
    context.canWrite = false;
    rerender(<QeetAISettingsPage />);
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
  });

  it("cancels pending removal when the organization changes before confirmation", async () => {
    const { rerender } = renderPage();
    await screen.findByLabelText("API key");
    fireEvent.click(screen.getByRole("button", { name: "Provider actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove key" }));
    const removeButton = await screen.findByRole("button", { name: "Remove key" });
    context.tenantId = "tenant-b";
    rerender(<QeetAISettingsPage />);
    fireEvent.click(removeButton);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove key" })).toBeNull());
    expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(
      false,
    );
  });

  it("removes the saved key only after confirmation and loads the fallback", async () => {
    let remoteConfig = savedConfig();
    vi.mocked(api).mockImplementation(async (_path, options) => {
      if (options?.method === "DELETE") {
        remoteConfig = {
          source: "platform",
          provider: "openai",
          model: "platform-model",
          platform_fallback: true,
        };
        return undefined as never;
      }
      return remoteConfig as never;
    });
    const { client } = renderPage();
    await screen.findByLabelText("API key");
    fireEvent.click(screen.getByRole("button", { name: "Provider actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove key" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove key" }));
    await screen.findByText(/provider key has been removed/);
    expect(screen.getByText("Qeet-managed")).toBeTruthy();
    expect(client.getQueryData([...QEETAI_PROVIDER_CONFIG_KEY, "tenant-a"])).toEqual(remoteConfig);
    expect(screen.queryByText("Ends in test")).toBeNull();
  });

  it("does not request or show protected metadata while access is unresolved", () => {
    context.state = "resolving";
    renderPage();
    expect(api).not.toHaveBeenCalled();
    expect(screen.queryByRole("form")).toBeNull();
  });
});

describe("Provider settings form model", () => {
  it("hydrates only configuration metadata, never a stored key", () => {
    const config = {
      source: "tenant" as const,
      provider: "openai",
      model: "custom-model",
      base_url: "https://gateway.example.test/v1",
      max_tokens: 4096,
      last4: "abcd",
      api_key: "not-a-real-key",
    };
    expect(providerSettingsDraft(config)).toEqual({
      provider: "openai",
      model: "custom-model",
      apiKey: "",
      baseUrl: "https://gateway.example.test/v1",
      maxTokens: "4096",
    });
  });

  it("clears provider-specific credentials, endpoints and models on provider changes", () => {
    expect(changeProvider("azure")).toEqual({
      provider: "azure",
      model: "",
      apiKey: "",
      baseUrl: "",
      maxTokens: "",
    });
    expect(changeProvider("openai").model).toBe("gpt-4o");
    expect(changeProvider("anthropic").model).toBe("claude-sonnet-5");
  });

  it("requires a new key and model for save or test", () => {
    expect(validateProviderSettings(providerSettingsDraft())).toEqual({
      apiKey: "required",
      model: "required",
    });
    const draft = { ...changeProvider("openai"), apiKey: "    " };
    expect(validateProviderSettings(draft).apiKey).toBe("required");
  });

  it("requires an Azure endpoint and rejects malformed URLs or embedded credentials", () => {
    const draft = { ...changeProvider("azure"), apiKey: "test-key", model: "deployment" };
    expect(validateProviderSettings(draft)).toEqual({ baseUrl: "required" });
    for (const baseUrl of [
      "not a URL",
      "file:///etc/passwd",
      "https://user:password@example.test",
    ]) {
      expect(validateProviderSettings({ ...draft, baseUrl }).baseUrl).toBe("url");
    }
    expect(
      validateProviderSettings({ ...draft, baseUrl: "https://gateway.example.test/v1" }),
    ).toEqual({});
  });

  it("accepts only whole token limits in the supported range", () => {
    const draft = { ...changeProvider("openai"), apiKey: "test-key" };
    for (const maxTokens of ["0", "-1", "1.5", "200001", "NaN"]) {
      expect(validateProviderSettings({ ...draft, maxTokens }).maxTokens).toBe("tokens");
    }
    for (const maxTokens of ["", "1", "4096", "200000"]) {
      expect(validateProviderSettings({ ...draft, maxTokens })).toEqual({});
    }
  });

  it("preserves custom model IDs and normalizes payloads without inventing defaults", () => {
    const draft = {
      ...changeProvider("openai"),
      model: "  custom-model  ",
      apiKey: "  test-key  ",
      maxTokens: "",
    };
    expect(providerSettingsInput(draft)).toEqual({
      provider: "openai",
      model: "custom-model",
      api_key: "test-key",
      base_url: undefined,
      max_tokens: undefined,
    });
  });
});
