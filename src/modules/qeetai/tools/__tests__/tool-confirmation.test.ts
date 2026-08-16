import { describe, expect, it } from "vitest";

import { listTools } from "../tool-registry";

// Security regression guard (audit P1-3): a Qeet AI tool that mutates state must
// require human confirmation. The execution engine gates confirmation on the
// presence of a `confirm` builder, so every mutating tool must declare one.
// A tool is "mutating" if it needs a write capability OR its name is a
// mutation verb. This test would have failed on enable_user / update_user.
const MUTATION_VERB = /^(create|update|delete|enable|disable|assign|grant|rotate|revoke|set)_/;

function isMutating(tool: { name: string; requiredCapability?: string }): boolean {
  return Boolean(tool.requiredCapability?.endsWith(".write")) || MUTATION_VERB.test(tool.name);
}

describe("Qeet AI tool confirmation gate", () => {
  it("every mutating tool declares a confirm builder", () => {
    const missing = listTools()
      .filter(isMutating)
      .filter((t) => typeof t.confirm !== "function")
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it("read-only tools are not forced to confirm", () => {
    const readOnly = listTools().filter(
      (t) => t.requiredCapability?.endsWith(".read") && !MUTATION_VERB.test(t.name),
    );
    expect(readOnly.length).toBeGreaterThan(0); // sanity: we actually have read tools
    for (const t of readOnly) expect(t.confirm).toBeUndefined();
  });
});
