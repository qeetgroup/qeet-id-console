import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyApiRequest } = vi.hoisted(() => ({ proxyApiRequest: vi.fn() }));

vi.mock("@/platform/auth/auth-lost", () => ({ onAuthLost: vi.fn() }));
vi.mock("@/platform/api/server-proxy", () => ({
  clearServerSession: vi.fn(),
  proxyApiRequest,
  refreshServerSessionNow: vi.fn(),
}));
vi.mock("@/platform/config/api-base-url", () => ({
  getApiBaseUrl: () => "https://api.qeet.test",
}));

import { discoverSSO } from "../sso";

const SESSION = { isAuthenticated: false, version: 1 };

function answer(status: number, data: unknown) {
  proxyApiRequest.mockResolvedValueOnce({ status, data, session: SESSION, sessionChanged: false });
}

const ldap = {
  id: "c1",
  protocol: "ldap",
  name: "Corp directory",
  method: "credentials",
  login_path: "/ldap/c1/authenticate",
};
const saml = {
  id: "c2",
  protocol: "saml",
  name: "Okta",
  method: "redirect",
  login_path: "/saml/login/c2",
};

beforeEach(() => proxyApiRequest.mockReset());

describe("discoverSSO", () => {
  it("posts the address and goes to the first connection a browser is sent to", async () => {
    answer(200, { sso: true, organization_name: "Acme", connections: [ldap, saml] });
    await expect(discoverSSO("ana@acme.test")).resolves.toEqual({
      provider_name: "Okta",
      redirect_url: "https://api.qeet.test/saml/login/c2",
    });
    expect(proxyApiRequest).toHaveBeenCalledWith({
      data: expect.objectContaining({
        path: "/v1/sso/discovery",
        method: "POST",
        body: { email: "ana@acme.test" },
      }),
    });
  });

  it("keeps the password path when only a directory-password connection is there", async () => {
    answer(200, { sso: true, connections: [ldap] });
    await expect(discoverSSO("ana@acme.test")).resolves.toBeNull();
  });

  it("keeps the password path when the domain has no SSO", async () => {
    answer(200, { sso: false, connections: [] });
    await expect(discoverSSO("ana@gmail.test")).resolves.toBeNull();
  });

  it("keeps the password path on a server without discovery", async () => {
    answer(404, { error: { code: "not_found", message: "Not found" } });
    await expect(discoverSSO("ana@acme.test")).resolves.toBeNull();
  });
});
