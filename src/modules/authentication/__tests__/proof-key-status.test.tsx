// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ getApiBaseUrl: () => "https://api.id.example" }));

import { type OidcClient, proofKeyStatus } from "@/modules/authentication/api/oidc-clients";
import { OidcQuickstart } from "@/modules/authentication/components/oidc-quickstart";
import { ProofKeyBadge, ProofKeyCard } from "@/modules/authentication/components/proof-key-status";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-20T12:00:00Z");

function app(over: Partial<OidcClient> = {}): OidcClient {
  return {
    id: "row-1",
    tenant_id: "t-1",
    client_id: "qci_app",
    name: "Acme",
    type: "confidential",
    redirect_uris: ["https://app.example/cb"],
    grant_types: ["authorization_code"],
    scopes: ["openid", "email"],
    created_at: "2026-10-01T00:00:00Z",
    pkce_exempt_until: null,
    ...over,
  };
}
const inDays = (d: number) => new Date(now.getTime() + d * DAY).toISOString();

describe("proofKeyStatus", () => {
  it("requires a proof key of an app with no exemption, and of every public app", () => {
    expect(proofKeyStatus(app(), now)).toEqual({ kind: "required" });
    expect(proofKeyStatus(app({ type: "public", pkce_exempt_until: inDays(30) }), now)).toEqual({
      kind: "required",
    });
  });

  it("reports an exemption, flagged as ending soon in its last week, and one that has ended", () => {
    expect(proofKeyStatus(app({ pkce_exempt_until: inDays(30) }), now)).toMatchObject({
      kind: "exempt",
      endingSoon: false,
    });
    expect(proofKeyStatus(app({ pkce_exempt_until: inDays(3) }), now)).toMatchObject({
      kind: "exempt",
      endingSoon: true,
    });
    expect(proofKeyStatus(app({ pkce_exempt_until: inDays(-1) }), now)).toMatchObject({
      kind: "ended",
    });
  });
});

describe("Proof key on an application", () => {
  it("shows an active exemption and when it ends", () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    render(<ProofKeyCard client={app({ pkce_exempt_until: inDays(30) })} />);
    expect(screen.getByText(/^Exempt until/)).toBeTruthy();
    expect(screen.getByText("Exempt")).toBeTruthy();
    vi.useRealTimers();
  });

  it("says an app with no exemption, or one that has ended, must send a proof key", () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    render(<ProofKeyCard client={app()} />);
    expect(screen.getByText(/Every sign-in must send a proof key/)).toBeTruthy();
    cleanup();
    render(<ProofKeyCard client={app({ pkce_exempt_until: inDays(-2) })} />);
    expect(screen.getByText(/Its exemption ended on/)).toBeTruthy();
    vi.useRealTimers();
  });

  it("marks an exemption ending soon in the list, and nothing for an app with none", () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    render(<ProofKeyBadge client={app({ pkce_exempt_until: inDays(2) })} />);
    expect(screen.getByText("PKCE exemption ends soon")).toBeTruthy();
    cleanup();
    const { container } = render(<ProofKeyBadge client={app()} />);
    expect(container.textContent).toBe("");
    vi.useRealTimers();
  });
});

describe("Test login", () => {
  it("opens the authorize flow with a proof key and a nonce", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<OidcQuickstart client={app()} />);
    fireEvent.click(screen.getByRole("button", { name: /test login/i }));

    await waitFor(() => expect(open).toHaveBeenCalled());
    const url = new URL(String(open.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v1/oauth/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
    expect(url.searchParams.get("nonce")).toBeTruthy();
  });
});
