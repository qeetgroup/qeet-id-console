// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
// Records each sensitive action's options while the real provider confirms and runs it.
const sensitive = vi.hoisted(() => ({ calls: [] as SensitiveActionOptions<unknown>[] }));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return <T,>(options: SensitiveActionOptions<T>) => {
        sensitive.calls.push(options);
        return run(options);
      };
    },
  };
});
vi.mock("@/shared/hooks/use-create-intent", async (importOriginal) => {
  const { useState } = await import("react");
  return {
    ...(await importOriginal<typeof import("@/shared/hooks/use-create-intent")>()),
    useCreateIntent: () => useState(false),
  };
});

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./keys";

const ApiKeysPage = Route.options.component as () => React.JSX.Element;

// The 201 body of POST /v1/api-keys: the key, its plaintext secret once, and a warning.
function created(name: string, secret?: string) {
  return {
    api_key: {
      id: `id-${name}`,
      tenant_id: "tenant-1",
      name,
      prefix: "qk_7Qx8t",
      scopes: ["users:read"],
      expires_at: null,
      created_at: "2026-09-24T10:15:00Z",
    },
    ...(secret ? { secret } : {}),
    warning: "The secret is shown only once. Store it now; it cannot be retrieved again.",
  };
}

let responses: ReturnType<typeof created>[];
let posted: Record<string, unknown>[];
let rejection: Error | undefined;
let listed: ReturnType<typeof created>["api_key"][];

beforeEach(() => {
  responses = [];
  posted = [];
  rejection = undefined;
  listed = [];
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/tenant-1/api-keys") return { items: listed };
    if (path.startsWith("/v1/api-keys/") && options?.method === "DELETE") return undefined;
    if (path === "/v1/api-keys" && options?.method === "POST") {
      posted.push(options.body as Record<string, unknown>);
      if (rejection) throw rejection;
      return responses.shift();
    }
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <ApiKeysPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function submitKey(name: string, expiresAt?: string) {
  fireEvent.click(screen.getByRole("button", { name: /new api key/i }));
  fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: name } });
  if (expiresAt !== undefined) {
    fireEvent.change(screen.getByLabelText("Expires at"), { target: { value: expiresAt } });
  }
  fireEvent.click(screen.getByRole("button", { name: /create key/i }));
}

async function createKey(name: string, expiresAt?: string) {
  await submitKey(name, expiresAt);
  await waitFor(() => expect(screen.queryByRole("button", { name: /create key/i })).toBeNull());
}

/** A Date as a datetime-local input value ("2026-11-01T10:30"), in local time. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minutesFromNow(minutes: number) {
  const d = new Date(Date.now() + minutes * 60_000);
  d.setSeconds(0, 0);
  return d;
}

describe("API keys — revealing a new key", () => {
  it("shows the new key's name and its full secret", async () => {
    responses.push(created("CI deploy bot", "qk_7Qx8t3f0a1b2c3d4e5f6g7h8i9j0k1l2"));
    renderPage();

    await createKey("CI deploy bot");

    expect(await screen.findByText("qk_7Qx8t3f0a1b2c3d4e5f6g7h8i9j0k1l2")).toBeTruthy();
    expect(screen.getByText(/only time we'll show CI deploy bot/)).toBeTruthy();
  });

  it("reveals each new key's own secret", async () => {
    responses.push(created("first", "qk_first_secret"), created("second", "qk_second_secret"));
    renderPage();

    await createKey("first");
    expect(await screen.findByText("qk_first_secret")).toBeTruthy();

    await createKey("second");
    expect(await screen.findByText("qk_second_secret")).toBeTruthy();
    expect(screen.queryByText("qk_first_secret")).toBeNull();
    expect(screen.getByText(/only time we'll show second/)).toBeTruthy();
  });

  it("shows an error, not an empty copy field, when no secret comes back", async () => {
    responses.push(created("no secret"));
    renderPage();

    await createKey("no secret");

    expect(await screen.findByText(/secret didn't come back/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
  });
});

describe("API keys — choosing an expiry", () => {
  it("sends the chosen local moment as an RFC 3339 instant", async () => {
    const tomorrow = minutesFromNow(24 * 60);
    responses.push(created("expiring", "qk_expiring_secret"));
    renderPage();

    await createKey("expiring", localInput(tomorrow));

    expect(posted).toHaveLength(1);
    expect(posted[0]?.expires_at).toBe(tomorrow.toISOString());
    expect(await screen.findByText("qk_expiring_secret")).toBeTruthy();
  });

  it("stops a past expiry at the field and sends nothing", async () => {
    renderPage();

    await submitKey("stale", localInput(minutesFromNow(-60)));

    expect(await screen.findByText(/must be in the future/i)).toBeTruthy();
    expect(posted).toHaveLength(0);
  });

  it("shows a plain message, not the parser's, when the server rejects the request", async () => {
    rejection = new ApiError(
      400,
      "bad_request",
      "The request was invalid.",
      'parsing time "2026-11-01T10:30" as "2006-01-02T15:04:05Z07:00"',
    );
    renderPage();

    await submitKey("rejected", localInput(minutesFromNow(60)));

    expect(await screen.findByText(/aren't valid/i)).toBeTruthy();
    expect(screen.queryByText(/parsing time/)).toBeNull();
  });

  it("still creates a key that never expires when no expiry is chosen", async () => {
    responses.push(created("forever", "qk_forever_secret"));
    renderPage();

    await createKey("forever");

    expect(posted).toHaveLength(1);
    const [body] = posted;
    assert(body, "expected the posted key body");
    expect(body.expires_at).toBeUndefined();
  });
});

describe("API keys — sensitive actions", () => {
  it("creates a key through the sensitive-action path, the form submit being the confirmation", async () => {
    responses.push(created("CI deploy bot", "qk_secret"));
    renderPage();

    await createKey("CI deploy bot");

    expect(sensitive.calls).toHaveLength(1);
    expect(sensitive.calls[0]?.actionLabel).toBe("Create this API key");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("revokes a key only after the admin confirms", async () => {
    listed = [created("CI deploy bot").api_key];
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /revoke/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain('Revoke "CI deploy bot"?');
    expect(api).not.toHaveBeenCalledWith("/v1/api-keys/id-CI deploy bot", { method: "DELETE" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/api-keys/id-CI deploy bot", { method: "DELETE" }),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("Revoke this API key");
  });

  it("revokes nothing when the admin cancels", async () => {
    listed = [created("CI deploy bot").api_key];
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /revoke/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api).not.toHaveBeenCalledWith("/v1/api-keys/id-CI deploy bot", { method: "DELETE" });
  });
});
