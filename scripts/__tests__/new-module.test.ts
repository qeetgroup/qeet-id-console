import { describe, expect, it } from "vitest";

import { moduleFiles, registerModuleId } from "../new-module.mjs";

describe("new-module", () => {
  const files = moduleFiles("audit-exports");

  it("creates a whole module inside its own folder", () => {
    expect(Object.keys(files).sort()).toEqual([
      "__tests__/audit-exports-page.test.tsx",
      "api/audit-exports.ts",
      "api/keys.ts",
      "components/audit-exports-page.tsx",
      "index.ts",
      "locales/en/audit-exports.json",
      "manifest.tsx",
      "pages.ts",
      "routes/app/audit-exports.tsx",
    ]);
    expect(files["manifest.tsx"]).toContain('id: "audit-exports"');
    // Its keys are typed from its own catalogue.
    expect(files["manifest.tsx"]).toContain(
      '"audit-exports": typeof import("./locales/en/audit-exports.json");',
    );
    expect(files["routes/app/audit-exports.tsx"]).toContain(
      'createFileRoute("/_app/audit-exports")',
    );
    expect(files["components/audit-exports-page.tsx"]).toContain(
      "export function AuditExportsPage",
    );
    expect(JSON.parse(files["locales/en/audit-exports.json"] ?? "").nav.title).toBe(
      "Audit exports",
    );
  });

  it("registers the module with one line in src/app/modules.ts, once", () => {
    const list = 'export const MODULES = [\n  "users",\n] as const;\n';
    const next = registerModuleId(list, "audit-exports");
    expect(next).toBe('export const MODULES = [\n  "users",\n  "audit-exports",\n] as const;\n');
    expect(registerModuleId(next ?? "", "audit-exports")).toBeNull();
  });
});
