import { afterEach, describe, expect, it, vi } from "vitest";

import { getApiBaseUrl, publicConfigScript } from "../api-base-url";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getApiBaseUrl", () => {
  it("reads PUBLIC_API_URL at runtime on the server, without a trailing slash", () => {
    vi.stubEnv("PUBLIC_API_URL", "http://api.id.qeet.localhost/");
    expect(getApiBaseUrl()).toBe("http://api.id.qeet.localhost");
  });

  it("falls back to the local default when nothing is configured", () => {
    vi.stubEnv("PUBLIC_API_URL", "");
    expect(getApiBaseUrl()).toBe("http://localhost:4001");
  });

  it("uses the config handed to the browser", () => {
    vi.stubGlobal("window", { __QEET_PUBLIC_CONFIG__: { apiUrl: "http://api.example.test" } });
    expect(getApiBaseUrl()).toBe("http://api.example.test");
  });
});

describe("publicConfigScript", () => {
  it("serialises the API URL and cannot break out of the script element", () => {
    vi.stubEnv("PUBLIC_API_URL", "http://api.example.test/</script><script>alert(1)");
    const script = publicConfigScript();
    expect(script.startsWith("window.__QEET_PUBLIC_CONFIG__=")).toBe(true);
    expect(script).not.toContain("</script>");
    expect(script).toContain("\\u003c/script>");
  });
});
