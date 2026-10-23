// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, assert, describe, expect, it } from "vitest";

import type { DecisionRecord } from "../api/simulate";
import { DecisionExplain } from "../components/explain/decision-explain";
import { DecisionBadge } from "../components/shared/decision-badge";

afterEach(cleanup);

/** Returns the list items under a heading; the JSON tree elsewhere renders lists too. */
function itemsUnder(heading: string): string[] {
  const section = screen.getByRole("heading", { name: heading }).closest("section");
  assert(section, `section for ${heading}`);
  return within(section)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
}

function record(overrides: Partial<DecisionRecord>): DecisionRecord {
  return {
    id: "d1",
    engine: "authzen",
    allowed: true,
    at: "2026-10-01T09:30:00Z",
    durationMs: 12.5,
    input: { action: "read" },
    ...overrides,
  };
}

describe("DecisionBadge", () => {
  it("reads ALLOW or DENY", () => {
    const { container, rerender } = render(<DecisionBadge allowed />);
    expect(container.textContent).toBe("ALLOW");
    rerender(<DecisionBadge allowed={false} />);
    expect(container.textContent).toBe("DENY");
  });
});

describe("DecisionExplain", () => {
  it("shows the outcome, engine, latency and the server's reason", () => {
    const { container } = render(
      <DecisionExplain record={record({ engine: "abac", allowed: false, reason: "no match" })} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("DENY");
    expect(text).toContain("ABAC");
    expect(text).toContain("Attribute-based conditions");
    expect(text).toContain("12.5 ms");
    expect(text).toContain("no match");
    expect(screen.getByRole("heading", { name: "Request" })).toBeTruthy();
  });

  it("lists RBAC grant paths, distinguishing direct roles from group inheritance", () => {
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "rbac",
          rbac: {
            allowed: true,
            reason: "granted",
            paths: [
              {
                permission: "users.read",
                granted_by: "Admin",
                via: "direct",
                role_id: "role-1234567890",
              },
              {
                permission: "users.read",
                granted_by: "Viewer",
                via: "group:Engineering",
                group_id: "g1",
                role_id: "role-abcdefghij",
              },
            ],
          },
        })}
      />,
    );
    const items = itemsUnder("Grant paths");
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("granted byAdmin");
    expect(items[0]).toContain("direct assignment");
    expect(items[0]).toContain("role role-123");
    expect(items[1]).toContain("via group:Engineering");
    expect(container.textContent).not.toContain("No grant path");
  });

  it("says no role grants access when RBAC returns no paths", () => {
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "rbac",
          allowed: false,
          rbac: { allowed: false, paths: [], reason: "" },
        })}
      />,
    );
    expect(container.textContent).toContain("No grant path — access is not granted by any role.");
  });

  it("walks the ABAC evaluation trace in order with the matched policy", () => {
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "abac",
          allowed: false,
          abac: {
            allow: false,
            effect: "deny",
            matched_policy_id: "policy-1234567890",
            trace: ["evaluate sox_payment_sod", "deny wins"],
          },
        })}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("matched policy policy-1");
    expect(text.indexOf("evaluate sox_payment_sod")).toBeLessThan(text.indexOf("deny wins"));
    expect(text).not.toContain("default deny");
  });

  it("explains an empty ABAC trace as the default deny", () => {
    const { container } = render(
      <DecisionExplain
        record={record({ engine: "abac", allowed: false, abac: { allow: false, effect: "" } })}
      />,
    );
    expect(container.textContent).toContain("No policy matched — default deny.");
  });

  it("lists each ReBAC hop from object to subject", () => {
    render(
      <DecisionExplain
        record={record({
          engine: "rebac",
          rebac: {
            allowed: true,
            path: [
              { object: "doc:1", relation: "viewer", subject: "group:eng#member", depth: 0 },
              { object: "group:eng", relation: "member", subject: "user:u1", depth: 1 },
            ],
          },
        })}
      />,
    );
    expect(itemsUnder("Relationship path")).toEqual([
      "hop 0doc:1#viewergroup:eng#member",
      "hop 1group:eng#memberuser:u1",
    ]);
  });

  it("says no relationship resolves when ReBAC returns no path", () => {
    const { container } = render(
      <DecisionExplain
        record={record({ engine: "rebac", allowed: false, rebac: { allowed: false } })}
      />,
    );
    expect(container.textContent).toContain("No relationship path resolves this check.");
  });

  it("shows the AuthZEN decision context", () => {
    render(
      <DecisionExplain
        record={record({
          engine: "authzen",
          authzen: { decision: true, context: { via: "rbac" } },
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Decision context" })).toBeTruthy();
  });
});
