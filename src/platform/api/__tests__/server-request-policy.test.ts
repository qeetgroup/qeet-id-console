import { describe, expect, it } from "vitest";

import { buildBackendUrl, isLocalSessionDestroyRequest } from "../server-request-policy";

describe("server request policy", () => {
  it("keeps relative API paths on the configured backend origin", () => {
    const url = buildBackendUrl("https://api.id.qeet.in", "/v1/users", { page: 2 });
    expect(url.href).toBe("https://api.id.qeet.in/v1/users?page=2");
  });

  it.each([
    "/https://attacker.example/capture",
    "//attacker.example/capture",
    "/v1/users?redirect=https://attacker.example",
    "/v1/users#fragment",
    "/v1\\users",
    "/v1/users/../auth/login",
  ])("rejects an unsafe or non-canonical path: %s", (path) => {
    expect(() => buildBackendUrl("https://api.id.qeet.in", path)).toThrow();
  });

  it("recognizes only the canonical logout mutation as a local session destroy", () => {
    expect(isLocalSessionDestroyRequest("/v1/auth/logout", "POST")).toBe(true);
    expect(isLocalSessionDestroyRequest("/v1/auth/logout", "GET")).toBe(false);
    expect(isLocalSessionDestroyRequest("/v1/account/delete", "POST")).toBe(false);
  });
});
