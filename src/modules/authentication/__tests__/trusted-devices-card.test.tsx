// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await vi.importActual<typeof import("@/platform/errors/api-error")>(
    "@/platform/errors/api-error",
  );
  return { api: vi.fn(), ApiError };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from "@/platform/api/client";
import { TrustedDevicesCard } from "../components/trusted-devices-card";

const devices = [
  {
    id: "d1",
    tenant_id: "t1",
    device: "Chrome on macOS",
    device_kind: "desktop",
    created_at: "2026-10-01T10:00:00Z",
    last_used_at: "2026-10-15T10:00:00Z",
    expires_at: "2026-10-31T10:00:00Z",
    current: true,
  },
  {
    id: "d2",
    tenant_id: "t1",
    device: "Safari on iPhone",
    device_kind: "mobile",
    created_at: "2026-09-20T10:00:00Z",
    last_used_at: null,
    expires_at: "2026-10-20T10:00:00Z",
    current: false,
  },
];

let deleted: string[];

beforeEach(() => {
  deleted = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if ((options?.method ?? "GET") === "DELETE") {
      deleted.push(path);
      return { forgotten: 1 };
    }
    return { items: devices };
  });
});

afterEach(cleanup);

function renderCard(props: Parameters<typeof TrustedDevicesCard>[0]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TrustedDevicesCard {...props} />
    </QueryClientProvider>,
  );
}

describe("TrustedDevicesCard", () => {
  it("lists the person's remembered devices and marks the one they are on", async () => {
    renderCard({ scope: { kind: "self" } });
    expect(await screen.findByText("Chrome on macOS")).toBeTruthy();
    expect(screen.getByText("Safari on iPhone")).toBeTruthy();
    expect(screen.getByText("This device")).toBeTruthy();
    expect(vi.mocked(api).mock.calls[0]?.[0]).toBe("/v1/auth/trusted-devices");
  });

  it("forgets one device after a confirmation", async () => {
    renderCard({ scope: { kind: "self" } });
    await screen.findByText("Safari on iPhone");
    const secondForget = screen.getAllByRole("button", { name: /^forget$/i })[1];
    assert(secondForget, "expected a second Forget button");
    fireEvent.click(secondForget);
    fireEvent.click(await screen.findByRole("button", { name: /^forget$/i, hidden: false }));
    await waitFor(() => expect(deleted).toContain("/v1/auth/trusted-devices/d2"));
  });

  it("shows a member's devices to an administrator who cannot change them, without the actions", async () => {
    renderCard({ scope: { kind: "member", userId: "u1" }, canForget: false });
    expect(await screen.findByText("Chrome on macOS")).toBeTruthy();
    expect(vi.mocked(api).mock.calls[0]?.[0]).toBe("/v1/users/u1/trusted-devices");
    expect(screen.queryByRole("button", { name: /forget/i })).toBeNull();
  });
});
