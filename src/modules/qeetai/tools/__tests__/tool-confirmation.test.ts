import { describe, expect, it } from "vitest";

import { listTools } from "../tool-registry";

// The engine asks for confirmation only when a tool has a `confirm` builder. A tool mutates if it
// needs a write capability or its name starts with one of these verbs.
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
    expect(readOnly.length).toBeGreaterThan(0);
    for (const t of readOnly) expect(t.confirm).toBeUndefined();
  });
});
