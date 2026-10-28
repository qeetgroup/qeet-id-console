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
// The breadcrumb reads the router's place in the navigation; not this page's concern.
vi.mock("@/modules/dashboard", () => ({ PageBreadcrumb: () => null }));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { qeetaiKeys } from "../api/keys";
import type { QeetAIProviderConfig, QeetAIStatus } from "../api/qeetai";
import {
  ProviderSettingsView,
  type ProviderSettingsViewProps,
  QeetAISettingsPage,
} from "../components/settings/qeetai-settings-page";
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

const NONE: QeetAIProviderConfig = { source: "none", platform_fallback: false };
const OFF: QeetAIStatus = { configured: false, available: false, source: "none" };
const ON: QeetAIStatus = { configured: true, available: true, source: "tenant" };

function viewProps(overrides: Partial<ProviderSettingsViewProps> = {}): ProviderSettingsViewProps {
  return {
    config: NONE,
    status: OFF,
    loading: false,
    fetching: false,
    canRead: true,
    canWrite: true,
    onRetry: vi.fn(),
    onSave: vi.fn().mockResolvedValue(savedConfig()),
    onTest: vi.fn().mockResolvedValue({ ok: true }),
    onRemove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function openConnect() {
  fireEvent.click(screen.getByRole("button", { name: /Connect a provider/ }));
  return screen.getByRole("form", { name: "Connect a provider" });
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

beforeEach(() => {
  context.tenantId = "tenant-a";
  context.state = "ready";
  context.canRead = true;
  context.canWrite = true;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(
    async (path) => (path === "/v1/qeetai/status" ? ON : savedConfig()) as never,
  );
});

afterEach(cleanup);

describe("Settings › Qeet AI", () => {
  it("says it's off and why, with one way to turn it on and what leaves Qeet ID", () => {
    render(<ProviderSettingsView {...viewProps()} />);
    expect(screen.getByRole("heading", { name: "Qeet AI", level: 1 })).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
    expect(screen.getByText(/no Qeet-managed one to fall back on/)).toBeTruthy();
    expect(screen.getByText("No provider connected")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Connect a provider/ })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "What leaves Qeet ID", level: 2 })).toBeTruthy();
    for (const term of ["To your provider", "Your key", "Cost", "Audit log"]) {
      expect(screen.getByText(term)).toBeTruthy();
    }
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("opens the form under the row, with the suggested model and a write-only key", () => {
    render(<ProviderSettingsView {...viewProps()} />);
    openConnect();
    expect(screen.getByRole("radio", { name: /Anthropic/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(field("Model").value).toBe("claude-sonnet-5");
    expect(field("API key").type).toBe("password");
    expect(field("API key").value).toBe("");
    expect(screen.getByRole("button", { name: "Save and turn on" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("saves the typed settings, then closes the form so the key goes with it", async () => {
    const props = viewProps();
    render(<ProviderSettingsView {...props} />);
    openConnect();
    fireEvent.change(field("API key"), { target: { value: "  fixture-key  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save and turn on" }));
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
    expect(props.onSave).toHaveBeenCalledWith({
      provider: "anthropic",
      model: "claude-sonnet-5",
      api_key: "fixture-key",
      base_url: undefined,
      max_tokens: undefined,
    });
    expect(props.onTest).not.toHaveBeenCalled();
  });

  it("explains what to fix before anything is tested or saved", () => {
    const props = viewProps();
    render(<ProviderSettingsView {...props} />);
    openConnect();
    fireEvent.click(screen.getByRole("button", { name: "Save and turn on" }));
    expect(screen.getByText("Fill this in to continue.")).toBeTruthy();
    fireEvent.change(field("API key"), { target: { value: "fixture-key" } });
    const endpoint = field("Base URL (optional)");
    fireEvent.change(endpoint, { target: { value: "invalid-url" } });
    fireEvent.blur(endpoint);
    expect(screen.getByText(/Enter a full http:\/\/ or https:\/\/ address/)).toBeTruthy();
    expect(endpoint.getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onTest).not.toHaveBeenCalled();
  });

  it.each([
    ["Model", "custom-model"],
    ["API key", "replacement-key"],
    ["Base URL (optional)", "https://gateway.example.test"],
  ])("drops a passed test when %s changes", async (label, value) => {
    const props = viewProps();
    render(<ProviderSettingsView {...props} />);
    openConnect();
    fireEvent.change(field("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("The provider accepted these settings")).toBeTruthy();
    expect(screen.getByText("Save to turn Qeet AI on.")).toBeTruthy();
    fireEvent.change(field(label), { target: { value } });
    expect(screen.queryByText("The provider accepted these settings")).toBeNull();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("clears the model and key when switching to Azure, whose base URL is required", async () => {
    render(<ProviderSettingsView {...viewProps()} />);
    openConnect();
    fireEvent.change(field("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("radio", { name: /Azure or compatible/ }));
    await waitFor(() => expect(field("Model").value).toBe(""));
    expect(field("API key").value).toBe("");
    expect(screen.getByLabelText("Base URL")).toBeTruthy();
    expect(screen.queryByLabelText("Base URL (optional)")).toBeNull();
  });

  it("never claims a failed test passed, nor shows the provider's own words", async () => {
    const props = viewProps();
    vi.mocked(props.onTest)
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error("private-key=fixture-key"));
    render(<ProviderSettingsView {...props} />);
    openConnect();
    fireEvent.change(field("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText(/The provider didn't accept these settings/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(props.onTest).toHaveBeenCalledTimes(2));
    await screen.findByText("The test didn't pass");
    expect(screen.queryByText("The provider accepted these settings")).toBeNull();
    expect(screen.queryByText(/private-key/)).toBeNull();
  });

  it("holds every field and a second save while a request runs", async () => {
    let finish: (result: { ok: boolean }) => void = () => {};
    const props = viewProps({
      onTest: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      ),
    });
    const { container } = render(<ProviderSettingsView {...props} />);
    openConnect();
    fireEvent.change(field("API key"), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onTest).toHaveBeenCalledOnce();
    expect(props.onSave).not.toHaveBeenCalled();
    for (const input of container.querySelectorAll("fieldset input")) {
      expect(input.matches(":disabled")).toBe(true);
    }
    await act(async () => finish({ ok: true }));
    expect(screen.getByText("The provider accepted these settings")).toBeTruthy();
  });

  it("shows the connected provider's facts, Change and Remove", () => {
    const props = viewProps({ config: savedConfig(), status: ON });
    render(<ProviderSettingsView {...props} />);
    expect(screen.getByText("On")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(
      screen.getByText("claude-sonnet-5 · key ending test · replies up to 4,096 tokens"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onRemove).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const form = screen.getByRole("form", { name: "Change the provider" });
    expect(field("Model").value).toBe("claude-sonnet-5");
    expect(field("API key").value).toBe("");
    expect(within(form).getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("names the Qeet-managed provider, and says when the plan leaves it out", () => {
    const config: QeetAIProviderConfig = {
      source: "platform",
      provider: "anthropic",
      model: "claude-sonnet-5",
      platform_fallback: true,
    };
    const { rerender } = render(<ProviderSettingsView {...viewProps({ config, status: ON })} />);
    expect(screen.getByText("Qeet-managed provider")).toBeTruthy();
    expect(screen.getByText("Included")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Connect your own/ })).toBeTruthy();
    const excluded: QeetAIStatus = { configured: true, available: false, source: "platform" };
    rerender(<ProviderSettingsView {...viewProps({ config, status: excluded })} />);
    expect(screen.getByText("Not in your plan")).toBeTruthy();
    expect(screen.getByText(/your plan doesn't include the Qeet-managed provider/)).toBeTruthy();
  });

  it("renders read-only, loading, failed and denied states", () => {
    const props = viewProps({ config: savedConfig(), status: ON });
    const { rerender } = render(<ProviderSettingsView {...props} canWrite={false} />);
    expect(screen.getByText(/You can see this setting/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    rerender(<ProviderSettingsView {...props} loading />);
    expect(screen.getByRole("status", { name: "Loading the provider settings" })).toBeTruthy();
    rerender(<ProviderSettingsView {...props} error={new Error("internal detail")} />);
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.queryByText(/internal detail/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    rerender(<ProviderSettingsView {...props} canRead={false} />);
    expect(screen.getByText("You can't see these settings")).toBeTruthy();
    expect(screen.queryByText(/key ending test/)).toBeNull();
  });
});

describe("Settings › Qeet AI against the server", () => {
  function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <SensitiveActionProvider>{children}</SensitiveActionProvider>
      </QueryClientProvider>
    );
    return { ...render(<QeetAISettingsPage />, { wrapper }), client };
  }

  const deletes = () =>
    vi.mocked(api).mock.calls.filter(([, options]) => options?.method === "DELETE").length;

  it("keeps the typed key out of every cache", async () => {
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/v1/qeetai/status") return OFF as never;
      return (options?.method === "PUT" ? savedConfig() : NONE) as never;
    });
    const { client } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Connect a provider/ }));
    fireEvent.change(field("API key"), { target: { value: "fixture-key-not-for-cache" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and turn on" }));
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
    expect(api).toHaveBeenCalledWith(
      "/v1/qeetai/provider-config",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({ api_key: "fixture-key-not-for-cache" }),
      }),
    );
    const cached = client
      .getQueryCache()
      .getAll()
      .map((query) => query.state.data);
    expect(JSON.stringify(cached)).not.toContain("fixture-key-not-for-cache");
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it("asks before removing the key, says what happens, and can be cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(/moves to the Qeet-managed provider/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deletes()).toBe(0);
  });

  it("removes the key only once confirmed, then shows the fallback", async () => {
    let remote: QeetAIProviderConfig = savedConfig();
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/v1/qeetai/status") return ON as never;
      if (options?.method === "DELETE") {
        remote = {
          source: "platform",
          provider: "openai",
          model: "gpt-4o",
          platform_fallback: true,
        };
        return undefined as never;
      }
      return remote as never;
    });
    const { client } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Remove key" }));
    expect(await screen.findByText("Qeet-managed provider")).toBeTruthy();
    expect(deletes()).toBe(1);
    expect(client.getQueryData(qeetaiKeys.providerConfig("tenant-a"))).toEqual(remote);
    expect(screen.queryByText(/key ending test/)).toBeNull();
  });

  it("drops a half-typed key when the organisation changes or the right to change it goes", async () => {
    const { rerender } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    fireEvent.change(field("API key"), { target: { value: "fixture-key" } });
    context.tenantId = "tenant-b";
    rerender(<QeetAISettingsPage />);
    await screen.findByRole("button", { name: "Change" });
    expect(screen.queryByRole("form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.change(field("API key"), { target: { value: "other-fixture-key" } });
    context.canWrite = false;
    rerender(<QeetAISettingsPage />);
    expect(screen.queryByLabelText("API key")).toBeNull();
  });

  it("calls off a removal when the organisation changes before it's confirmed", async () => {
    const { rerender } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const confirm = await screen.findByRole("alertdialog");
    context.tenantId = "tenant-b";
    rerender(<QeetAISettingsPage />);
    fireEvent.click(within(confirm).getByRole("button", { name: "Remove key" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deletes()).toBe(0);
  });

  it("asks the server for nothing while access is unresolved", () => {
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
