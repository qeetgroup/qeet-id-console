import { describe, expect, it } from "vitest";

import type { Anomaly } from "../api/anomalies";
import type { DeviceAuth } from "../api/device-auth";
import { anomalyFacts, matches, perDay, sourceAddress, topSources } from "../anomaly-model";
import { actorKind } from "../audit-model";
import { clientKind, clientName, groupClients } from "../bot-model";
import { deviceState } from "../device-model";

const anomaly = (patch: Partial<Anomaly>): Anomaly => ({
  id: "a",
  type: "credential_stuffing",
  severity: "high",
  detail: "",
  status: "rate-limited",
  created_at: "2026-10-26T10:00:00Z",
  ...patch,
});

describe("anomalies", () => {
  it("reads what the lockout counted, and the one network a deny rule could name", () => {
    const spray = anomaly({
      type: "password_spraying",
      ip: "198.51.100.252",
      metadata: {
        counter: "source",
        distinct_accounts: 31,
        window_minutes: 15,
        throttled_until: "2026-10-26T10:15:00Z",
      },
    });
    expect(anomalyFacts(spray)).toMatchObject({ accounts: 31, windowMinutes: 15, throttled: true });
    expect(sourceAddress(spray)).toBe("198.51.100.252");
    // An account locked from any network names no one network.
    expect(
      sourceAddress(anomaly({ ip: "203.0.113.1", metadata: { counter: "account", networks: 4 } })),
    ).toBeUndefined();
  });

  it("stays open until it's resolved, whatever its status says", () => {
    expect(matches(anomaly({ status: "rate-limited" }), { status: "open" })).toBe(true);
    expect(matches(anomaly({ resolved_at: "2026-10-26T11:00:00Z" }), { status: "open" })).toBe(
      false,
    );
    expect(matches(anomaly({ user_email: "ines@qeet.in" }), { q: "INES" })).toBe(true);
  });

  it("counts a day at a time and the addresses seen most", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const items = [
      anomaly({ ip: "192.0.2.1", created_at: "2026-10-28T08:00:00Z" }),
      anomaly({ ip: "192.0.2.1", created_at: "2026-10-27T08:00:00Z" }),
      anomaly({ ip: "192.0.2.9", created_at: "2026-10-27T09:00:00Z" }),
    ];
    expect(perDay(items, now, 3)).toEqual([0, 2, 1]);
    expect(topSources(items)[0]).toEqual({ ip: "192.0.2.1", count: 2 });
  });
});

describe("bots", () => {
  it("names a client from its user agent, and what its score means", () => {
    expect(clientName("curl/8.7.1")).toBe("curl 8.7.1");
    expect(clientName("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/153.0")).toBe(
      "Headless Chrome 153 · Linux",
    );
    expect(clientName("")).toBe("");
    expect([clientKind(0.95), clientKind(0.9), clientKind(0.55)]).toEqual([
      "script",
      "none",
      "app",
    ]);
  });

  it("groups decisions into one row per client and address, newest verdict first", () => {
    const rows = groupClients([
      {
        id: "1",
        ip: "203.0.113.9",
        user_agent: "curl/8.7.1",
        score: 0.95,
        verdict: "blocked",
        created_at: "2026-10-28T10:00:00Z",
      },
      {
        id: "2",
        ip: "203.0.113.9",
        user_agent: "curl/8.7.1",
        score: 0.95,
        verdict: "blocked",
        created_at: "2026-10-28T09:00:00Z",
      },
      {
        id: "3",
        ip: "203.0.113.8",
        user_agent: "curl/8.7.1",
        score: 0.95,
        verdict: "blocked",
        created_at: "2026-10-28T08:00:00Z",
      },
    ]);
    expect(rows.map((r) => [r.ip, r.count])).toEqual([
      ["203.0.113.9", 2],
      ["203.0.113.8", 1],
    ]);
  });
});

describe("device sign-ins and audit actors", () => {
  it("calls a lapsed pending code expired", () => {
    const d = { status: "pending", expires_at: "2026-10-28T10:00:00Z" } as DeviceAuth;
    expect(deviceState(d, Date.parse("2026-10-28T09:55:00Z"))).toBe("waiting");
    expect(deviceState(d, Date.parse("2026-10-28T10:05:00Z"))).toBe("expired");
    expect(deviceState({ ...d, status: "authorized" }, 0)).toBe("approved");
  });

  it("tells a person from Qeet ID itself and from nobody signed in", () => {
    expect(actorKind({ actor_type: "user", actor_user_id: "u" })).toBe("person");
    expect(actorKind({ actor_type: "system", actor_user_id: "u" })).toBe("system");
    expect(actorKind({ actor_type: "user", actor_user_id: null })).toBe("anonymous");
    expect(actorKind({ actor_type: "api_key", actor_user_id: null })).toBe("machine");
  });
});
