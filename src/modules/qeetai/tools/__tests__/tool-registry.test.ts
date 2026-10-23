import { describe, expect, it } from "vitest";

import { ASSISTANT_CHANGE_TOOLS_ENABLED, enabledTools, listTools } from "../tool-registry";

// A tool named with one of these verbs changes something, so it must declare `mutates`.
const MUTATION_VERB =
  /^(create|update|delete|enable|disable|assign|grant|rotate|revoke|set|reset)_/;
const allowAll = () => true;

describe("Qeet AI change tools are off for 1.0", () => {
  it("keeps change tools switched off", () => {
    expect(ASSISTANT_CHANGE_TOOLS_ENABLED).toBe(false);
  });

  it("every tool declares whether it changes anything", () => {
    const undeclared = listTools()
      .filter((t) => typeof (t as { mutates?: unknown }).mutates !== "boolean")
      .map((t) => t.name);
    expect(undeclared).toEqual([]);
  });

  it("a tool that looks like a change is declared as one", () => {
    const missed = listTools()
      .filter(
        (t) =>
          MUTATION_VERB.test(t.name) ||
          t.destructive ||
          typeof t.confirm === "function" ||
          t.requiredCapability?.endsWith(".write"),
      )
      .filter((t) => !t.mutates)
      .map((t) => t.name);
    expect(missed).toEqual([]);
  });

  it("every change tool points the operator at the screen that does it", () => {
    const unguided = listTools()
      .filter((t) => t.mutates && !t.consoleScreen?.to.startsWith("/"))
      .map((t) => t.name);
    expect(unguided).toEqual([]);
  });

  it("enables no change tool, even with every capability", () => {
    const enabled = enabledTools(allowAll);
    expect(enabled.filter((t) => t.mutates).map((t) => t.name)).toEqual([]);
  });

  it("still enables every read-only tool", () => {
    const readOnly = listTools()
      .filter((t) => !t.mutates)
      .map((t) => t.name);
    expect(readOnly.length).toBeGreaterThan(0);
    expect(enabledTools(allowAll).map((t) => t.name)).toEqual(readOnly);
  });

  it("brings the change tools back when the switch is on", () => {
    expect(enabledTools(allowAll, true)).toEqual(listTools());
  });
});
