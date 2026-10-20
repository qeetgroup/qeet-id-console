import { afterEach, describe, expect, it } from "vitest";

import { clientAddress, relayHeaders } from "../relay";

afterEach(() => {
  delete process.env.CONSOLE_TRUSTED_PROXY_HOPS;
  delete process.env.QEET_ID_RELAY_KEY;
});

function req(forwarded?: string) {
  return new Request(
    "http://console.test/",
    forwarded ? { headers: { "x-forwarded-for": forwarded } } : {},
  );
}

describe("clientAddress", () => {
  it("is the connection's peer when no proxy is trusted, whatever X-Forwarded-For says", () => {
    expect(clientAddress(req("6.6.6.6"), "198.51.100.7")).toBe("198.51.100.7");
  });

  it("counts trusted proxies from the right, so a forged leftmost entry is ignored", () => {
    process.env.CONSOLE_TRUSTED_PROXY_HOPS = "1";
    expect(clientAddress(req("6.6.6.6, 198.51.100.7"), "10.0.0.2")).toBe("198.51.100.7");
  });

  it("falls back to the peer when the chain is shorter than declared, and refuses non-addresses", () => {
    process.env.CONSOLE_TRUSTED_PROXY_HOPS = "2";
    expect(clientAddress(req("198.51.100.7"), "10.0.0.2")).toBe("10.0.0.2");
    expect(clientAddress(req(), "not-an-ip")).toBeNull();
  });
});

describe("relayHeaders", () => {
  it("sends nothing without a relay key, so the API keeps judging the console's own address", () => {
    expect(relayHeaders(req(), "198.51.100.7")).toEqual({});
  });

  it("names the address with the key when both are known", () => {
    process.env.QEET_ID_RELAY_KEY = "k".repeat(40);
    expect(relayHeaders(req(), "198.51.100.7")).toEqual({
      "X-Qeet-Relay-Key": "k".repeat(40),
      "X-Qeet-Client-IP": "198.51.100.7",
    });
    expect(relayHeaders(req(), null)).toEqual({});
  });
});
