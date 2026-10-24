import { describe, expect, it } from "vitest";
import "@/i18n";

import {
  applicationHomePage,
  applicationLogo,
  PRESENTATION_URI_MAX_LENGTH,
  presentationUriField,
  presentationUriProblem,
} from "../application-presentation-model";

describe("An application's logo and home page address", () => {
  it("accepts a blank one, which is none or clears it, and an absolute https URL", () => {
    for (const value of [
      "",
      "   ",
      "https://app.example.com",
      "HTTPS://App.Example.com/logo.svg?v=2",
      "  https://app.example.com/  ",
      "https://[2001:db8::1]:8443/logo.png",
    ]) {
      expect(presentationUriProblem(value), value).toBeNull();
    }
    const longest = `https://app.example.com/${"a".repeat(PRESENTATION_URI_MAX_LENGTH - 24)}`;
    expect(longest).toHaveLength(PRESENTATION_URI_MAX_LENGTH);
    expect(presentationUriProblem(longest)).toBeNull();
    expect(presentationUriProblem(`${longest}a`)).toBe("tooLong");
  });

  it("refuses http and every other scheme", () => {
    for (const value of ["http://app.example.com", "ftp://app.example.com", "data://x"]) {
      expect(presentationUriProblem(value), value).toBe("notHttps");
    }
  });

  it("refuses what the browser would read more leniently than the server", () => {
    for (const value of [
      "app.example.com",
      "/logo.svg",
      "https://",
      "https:app.example.com",
      "https:///app.example.com",
      "https:\\\\app.example.com",
      "https://app.example.com\\logo.svg",
      "https://app.exa mple.com",
      "https://app.example.com/a\tb",
      "javascript:alert(1)",
      "mailto:admin@example.com",
    ]) {
      expect(presentationUriProblem(value), value).toBe("malformed");
    }
  });

  it("refuses credentials and a fragment, even an empty one", () => {
    expect(presentationUriProblem("https://user:secret@app.example.com")).toBe("credentials");
    expect(presentationUriProblem("https://user@app.example.com")).toBe("credentials");
    expect(presentationUriProblem("https://app.example.com/#top")).toBe("fragment");
    expect(presentationUriProblem("https://app.example.com/#")).toBe("fragment");
  });

  it("says in the form what is wrong", () => {
    expect(presentationUriField.safeParse("https://app.example.com").success).toBe(true);
    const http = presentationUriField.safeParse("http://app.example.com");
    expect(http.error?.issues[0]?.message).toBe(
      "Use an https:// address: http and other schemes aren't accepted.",
    );
  });

  it("shows only an https logo, and the home page by its host", () => {
    expect(applicationLogo("https://cdn.example.com/logo.svg")).toBe(
      "https://cdn.example.com/logo.svg",
    );
    for (const value of [undefined, "", "http://cdn.example.com/logo.svg", "javascript:x"]) {
      expect(applicationLogo(value), value).toBeUndefined();
    }
    expect(applicationHomePage("https://App.Example.com:8443/start")).toEqual({
      host: "app.example.com:8443",
      href: "https://app.example.com:8443/start",
    });
    expect(applicationHomePage("")).toBeUndefined();
    expect(applicationHomePage("http://app.example.com")).toBeUndefined();
  });
});
