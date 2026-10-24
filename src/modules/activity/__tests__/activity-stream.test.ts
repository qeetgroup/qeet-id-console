import { describe, expect, it } from "vitest";

import { parseActivityEvent } from "../activity-stream";

const login = {
  id: "evt-abc",
  type: "user.login.success",
  category: "authentication",
  severity: "success",
  title: "User logged in",
  at: "2024-06-15T12:00:00Z",
  actor: { name: "alice", type: "user" },
};

function activity(data: unknown) {
  return { event: "activity", data: typeof data === "string" ? data : JSON.stringify(data) };
}

describe("parseActivityEvent", () => {
  it("parses a well-formed activity event", () => {
    const result = parseActivityEvent(activity(login));
    expect(result?.id).toBe("evt-abc");
    expect(result?.type).toBe("user.login.success");
    expect(result?.severity).toBe("success");
    expect(result?.actor?.name).toBe("alice");
  });

  it("ignores events of any other name", () => {
    expect(parseActivityEvent({ event: "heartbeat", data: JSON.stringify(login) })).toBeNull();
    expect(parseActivityEvent({ event: "message", data: JSON.stringify(login) })).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseActivityEvent(activity("{not valid json}"))).toBeNull();
  });

  it("returns null when the id is missing or empty", () => {
    expect(parseActivityEvent(activity({ ...login, id: undefined }))).toBeNull();
    expect(parseActivityEvent(activity({ ...login, id: "" }))).toBeNull();
  });

  it("returns null when the type is missing", () => {
    expect(parseActivityEvent(activity({ ...login, type: undefined }))).toBeNull();
  });
});
