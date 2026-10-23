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
  it("shows the outcome, engine, latency and the server's reason in the reader's words", () => {
    const reason = 'explicitly denied by policy "deny_contractors" (priority 90)';
    const { container } = render(
      <DecisionExplain record={record({ engine: "abac", allowed: false, reason })} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("DENY");
    expect(text).toContain("ABAC");
    expect(text).toContain("Attribute-based conditions");
    expect(text).toContain("12.5 ms");
    expect(text).toContain("Explicitly denied by policy “deny_contractors” (priority 90).");
    expect(text).not.toContain(reason);
    expect(screen.getByRole("heading", { name: "Request" })).toBeTruthy();
  });

  it("maps the RBAC deny reason to the console's own sentence", () => {
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "rbac",
          allowed: false,
          reason: "no role grants this permission for this user in this tenant",
        })}
      />,
    );
    expect(container.textContent).toContain(
      "No role grants this permission to this person in this organization.",
    );
  });

  it("names the policy behind a condition error but never shows the error itself", () => {
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "abac",
          allowed: false,
          reason: 'condition error in policy "geo_fence": regexp: Compile(`(`): missing )',
          abac: {
            allow: false,
            effect: "deny",
            trace: [
              'policy "geo_fence": condition error (regexp: Compile(`(`): missing )) → fail-closed deny',
            ],
          },
        })}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("A condition in policy “geo_fence” couldn't be evaluated.");
    expect(text).toContain("Policy “geo_fence”: a condition couldn't be evaluated → deny");
    expect(text).not.toContain("regexp");
    expect(text).not.toContain("Compile");
  });

  it("reads a reason it doesn't recognise as a generic line, never the server's text", () => {
    const { container } = render(
      <DecisionExplain
        record={record({ engine: "abac", allowed: false, reason: "pq: relation does not exist" })}
      />,
    );
    expect(container.textContent).toContain(
      "The decision point gave a reason the console can't display.",
    );
    expect(container.textContent).not.toContain("pq:");
    expect(container.textContent).not.toContain("relation does not exist");
  });

  it("words the reason from the server's code rather than its sentence", () => {
    const reason = 'condition error in policy "geo"';
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "abac",
          allowed: false,
          reason,
          abac: {
            allow: false,
            effect: "deny",
            reason,
            reason_code: "authz.condition_error",
            reason_params: { policy_id: "p1", policy_name: "geo", priority: 50 },
          },
        })}
      />,
    );
    expect(container.textContent).toContain("A condition in policy “geo” couldn't be evaluated.");
    expect(container.textContent).not.toContain(reason);
  });

  it("still words a code whose policy the reader may not see", () => {
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "abac",
          allowed: false,
          reason: 'explicitly denied by policy "secret" (priority 9)',
          abac: { allow: false, effect: "deny", reason_code: "authz.denied_by_policy" },
        })}
      />,
    );
    expect(container.textContent).toContain("Explicitly denied by an ABAC policy.");
    expect(container.textContent).not.toContain("secret");
  });

  it("summarises an AuthZEN decision from decided_by", () => {
    const { container } = render(
      <DecisionExplain
        record={record({
          engine: "authzen",
          authzen: {
            decision: true,
            context: {
              decided_by: {
                model: "rebac",
                reason_code: "authz.relation_grant",
                reason_params: { relation: "viewer", object: "doc:1" },
              },
            },
          },
        })}
      />,
    );
    expect(container.textContent).toContain("The relationship viewer on doc:1 grants access.");
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
    expect(items[0]).toContain("Direct assignment");
    expect(items[0]).toContain("role role-123");
    expect(items[1]).toContain("Group · Engineering");
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
            trace: [
              'policy "sox_payment_sod" (effect=deny, priority=95): condition matched → deny',
              'policy "allow_finance" (effect=allow, priority=10): condition not matched',
              "policy step the console has never seen",
            ],
          },
        })}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("matched policy policy-1");
    const first = "Policy “sox_payment_sod” (deny, priority 95): condition matched → deny";
    const second = "Policy “allow_finance” (allow, priority 10): condition not matched";
    expect(text).toContain(first);
    expect(text.indexOf(first)).toBeLessThan(text.indexOf(second));
    expect(text).toContain("An evaluation step the console can't display");
    expect(text).not.toContain("never seen");
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
