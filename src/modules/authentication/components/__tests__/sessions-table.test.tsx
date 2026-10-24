// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/modules/authentication/api/sessions";
import { SessionsTable } from "../sessions-table";

afterEach(cleanup);

const base: Session = {
  id: "s1",
  user_id: "u1",
  tenant_id: "t1",
  ip: "203.0.113.9",
  user_agent: "Mozilla/5.0 Chrome",
  created_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  revoked_at: null,
  device: "Chrome on macOS",
  device_kind: "desktop",
};

// Minimal stand-in for a resolved useQuery result.
function q(items: Session[]) {
  return {
    data: { items },
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as Parameters<typeof SessionsTable>[0]["query"];
}

describe("SessionsTable", () => {
  it("renders a row per session and calls onRevoke for an active session", () => {
    const onRevoke = vi.fn();
    render(<SessionsTable query={q([base])} onRevoke={onRevoke} />);
    expect(screen.getByText(/Chrome/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    expect(onRevoke).toHaveBeenCalledWith(base);
  });

  it("shows the server's device description and country, keeping the raw user agent on hover", () => {
    render(<SessionsTable query={q([{ ...base, country: "IN" }])} onRevoke={vi.fn()} />);
    expect(screen.getByText(/Chrome on macOS/)).toBeTruthy();
    expect(screen.getByText(/India/)).toBeTruthy();
    expect(screen.getByTitle("Mozilla/5.0 Chrome")).toBeTruthy();
  });

  it("names a device the server could not describe neutrally", () => {
    render(<SessionsTable query={q([{ ...base, device: undefined }])} onRevoke={vi.fn()} />);
    expect(screen.getByText(/Unknown device/)).toBeTruthy();
  });

  it("marks the session the server says is the current one", () => {
    render(<SessionsTable query={q([{ ...base, current: true }])} onRevoke={vi.fn()} />);
    expect(screen.getByText(/This device/i)).toBeTruthy();
  });

  it("marks the current session and disables its revoke button", () => {
    const onRevoke = vi.fn();
    render(<SessionsTable query={q([base])} currentSessionId="s1" onRevoke={onRevoke} />);
    expect(screen.getByText(/This device/i)).toBeTruthy();
    const btn = screen.getByRole("button", { name: /revoke/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onRevoke).not.toHaveBeenCalled();
  });

  it("disables revoke for an already-revoked session", () => {
    render(
      <SessionsTable
        query={q([{ ...base, revoked_at: new Date().toISOString() }])}
        onRevoke={vi.fn()}
      />,
    );
    expect((screen.getByRole("button", { name: /revoke/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("masks a loopback IP as localhost", () => {
    render(<SessionsTable query={q([{ ...base, ip: "::ffff:127.0.0.1" }])} onRevoke={vi.fn()} />);
    expect(screen.getByText("localhost")).toBeTruthy();
  });
});
