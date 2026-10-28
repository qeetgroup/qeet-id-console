import { describe, expect, it } from "vitest";
import "@/i18n";

import type { ActivityEvent } from "@/modules/activity";
import {
  permissionAreas,
  personNames,
  sessionSpans,
  signInMethod,
  signInMix,
  workAttributes,
} from "../person-model";

const DAY = 86_400_000;
const event = (method: string): ActivityEvent => ({
  id: method,
  type: "auth.login_succeeded",
  category: "authentication",
  severity: "success",
  title: "",
  at: "2026-10-28T00:00:00Z",
  metadata: { method },
});

describe("personNames", () => {
  it("writes the full name, and the first word of it in sentences", () => {
    expect(personNames({ display_name: "Ananya Iyer", email: "a@qeet.in" })).toEqual({
      full: "Ananya Iyer",
      first: "Ananya",
    });
  });

  it("falls back to the email address, whole, when there's no name", () => {
    expect(personNames({ display_name: " ", email: "a@qeet.in" })).toEqual({
      full: "a@qeet.in",
      first: "a@qeet.in",
    });
  });
});

describe("signInMethod", () => {
  it("reads the first factor, and a met challenge from the _mfa suffix", () => {
    expect(signInMethod("password_mfa")).toEqual({ method: "password", secondStep: true });
    expect(signInMethod("saml")).toEqual({ method: "sso", secondStep: false });
    expect(signInMethod("ldap")).toEqual({ method: "sso", secondStep: false });
    expect(signInMethod("magic_link")).toEqual({ method: "magicLink", secondStep: false });
  });

  it("counts a passkey as the second step on its own, as the server does", () => {
    expect(signInMethod("passkey")).toEqual({ method: "passkey", secondStep: true });
  });

  it("files an unknown or missing method under another way", () => {
    expect(signInMethod(undefined)).toEqual({ method: "other", secondStep: false });
    expect(signInMethod("unknown")).toEqual({ method: "other", secondStep: false });
  });
});

describe("signInMix", () => {
  it("leaves out moves between organisations, which the server records as sign-ins too", () => {
    const mix = signInMix(["tenant_switch", "password", "tenant_create"].map(event));
    expect(mix.total).toBe(1);
    expect(mix.methods).toEqual([{ method: "password", count: 1 }]);
  });

  it("counts each method, most used first, and the sign-ins that met a second step", () => {
    const mix = signInMix(["saml", "social_mfa", "saml", "passkey", "saml"].map(event));
    expect(mix.total).toBe(5);
    expect(mix.secondStep).toBe(2);
    expect(mix.methods).toEqual([
      { method: "sso", count: 3 },
      { method: "social", count: 1 },
      { method: "passkey", count: 1 },
    ]);
  });
});

describe("permissionAreas", () => {
  it("groups permissions by what they reach, and says whether they can change it", () => {
    expect(permissionAreas(["user.read", "apikey.write", "apikey.read", "tenant.read"])).toEqual([
      {
        resource: "apikey",
        permissions: ["apikey.read", "apikey.write"],
        changes: true,
        everything: false,
      },
      { resource: "tenant", permissions: ["tenant.read"], changes: false, everything: false },
      { resource: "user", permissions: ["user.read"], changes: false, everything: false },
    ]);
  });

  it("marks a wildcard as everything", () => {
    expect(permissionAreas(["role.*"])[0]).toMatchObject({ everything: true, changes: true });
  });
});

describe("sessionSpans", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  const session = (id: string, openedDaysAgo: number, seenDaysAgo: number) => ({
    id,
    ip: null,
    user_agent: null,
    created_at: new Date(now - openedDaysAgo * DAY).toISOString(),
    last_seen_at: new Date(now - seenDaysAgo * DAY).toISOString(),
  });

  it("places each session from when it opened to its last request, latest first", () => {
    const { spans } = sessionSpans([session("old", 7, 7), session("new", 7, 0)], now, 14);
    expect(spans.map((s) => s.id)).toEqual(["new", "old"]);
    expect(spans[0]).toEqual({ id: "new", from: 0.5, to: 1, before: false });
  });

  it("clamps a session opened before the window to its start, and says so", () => {
    const { spans } = sessionSpans([session("long", 30, 1)], now, 14);
    expect(spans[0]?.from).toBe(0);
    expect(spans[0]?.before).toBe(true);
  });
});

describe("workAttributes", () => {
  it("lists the named attributes first, then the others by key, without the locale", () => {
    expect(
      workAttributes({
        locale: "en",
        cost_centre: "CC-12",
        team: "Frontend",
        title: "Engineer",
        empty: " ",
        nested: { a: 1 },
      }),
    ).toEqual([
      { key: "title", value: "Engineer" },
      { key: "team", value: "Frontend" },
      { key: "cost_centre", value: "CC-12" },
    ]);
  });
});
