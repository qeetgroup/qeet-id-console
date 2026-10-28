// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
// A native select stands in for the searchable combobox, which jsdom can't drive reliably.
vi.mock("@qeetrix/react/experimental", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@qeetrix/react/experimental")>()),
  Combobox: ({
    items,
    value,
    onValueChange,
  }: {
    items: { label: string; value: string }[];
    value: string;
    onValueChange: (v: string | null) => void;
  }) => (
    <select
      data-testid="place"
      value={value}
      onChange={(e) => onValueChange(e.target.value || null)}
    >
      {items.map((i) => (
        <option key={i.value} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  ),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { Group, GroupTemplate } from "../api/groups";
import { GroupTemplatesDrawer } from "../components/group-templates-drawer";
import { ImportGroupsDrawer } from "../components/import-groups-drawer";

const group = (id: string, name: string, parent: string | null = null): Group => ({
  id,
  tenant_id: "t-1",
  parent_id: parent,
  name,
  description: "",
  created_at: "2025-08-18T10:00:00Z",
  member_count: 1,
});
const GROUPS = [
  group("eng", "Engineering"),
  group("pay", "Payments", "eng"),
  group("ops", "Operations"),
];
const template = (id: string, name: string, nodes: GroupTemplate["nodes"]): GroupTemplate => ({
  id,
  tenant_id: "t-1",
  name,
  description: "",
  nodes,
  created_at: "2025-09-17T10:00:00Z",
  group_count: nodes.length + nodes.reduce((s, n) => s + (n.children?.length ?? 0), 0),
});
let templates: GroupTemplate[];

beforeEach(() => {
  templates = [
    template("squad", "Product squad", [
      { name: "Squad", children: [{ name: "Squad Engineering" }, { name: "Squad Design" }] },
    ]),
    template("dept", "Department starter", [
      { name: "Engineering", children: [{ name: "Platform" }, { name: "Payments" }] },
    ]),
  ];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/groups/templates" && method === "GET") return { items: templates };
    if (path === "/v1/groups/templates/squad/apply" && method === "POST") return { items: [] };
    if (path === "/v1/groups/templates" && method === "POST")
      return template(
        "new",
        "Regional office",
        (options?.body as { nodes: GroupTemplate["nodes"] } | undefined)?.nodes ?? [],
      );
    if (path === "/v1/groups/import" && method === "POST") {
      const rows = (options?.body as { groups: { name: string }[] } | undefined)?.groups ?? [];
      return {
        created: rows.length - 1,
        skipped: 0,
        failed: 1,
        rows: rows.map((r, i) => ({
          name: r.name,
          status: i === rows.length - 1 ? "failed" : "created",
          code: i === rows.length - 1 ? "group.import_parent_not_found" : undefined,
        })),
      };
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, o]) => (o?.method ?? "GET") !== "GET")
    .map(([p, o]) => ({ call: `${o?.method} ${p}`, body: o?.body }));
function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{ui}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return () => screen.getAllByRole("dialog")[0] as HTMLElement;
}

describe("New from a template", () => {
  it("makes a template's groups inside the group chosen", async () => {
    const onOpenChange = vi.fn();
    const dialog = mount(<GroupTemplatesDrawer open onOpenChange={onOpenChange} groups={GROUPS} />);
    expect(await within(dialog()).findByText("It makes 3 groups")).toBeTruthy();
    fireEvent.change(screen.getByTestId("place"), { target: { value: "eng" } });
    expect(within(dialog()).getByText("They'll sit inside Engineering.")).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Make 3 groups" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(writes()).toEqual([
      { call: "POST /v1/groups/templates/squad/apply", body: { parent_id: "eng" } },
    ]);
  });

  it("flags names already taken and makes nothing, since a template is made all at once", async () => {
    const dialog = mount(<GroupTemplatesDrawer open onOpenChange={vi.fn()} groups={GROUPS} />);
    fireEvent.click(await within(dialog()).findByRole("radio", { name: /Department starter/ }));
    expect(
      within(dialog()).getByText("2 names in it are taken, so nothing would be made"),
    ).toBeTruthy();
    expect(within(dialog()).getByText("Already exists in Engineering")).toBeTruthy();
    expect(
      within(dialog()).getByRole("button", { name: "Make 3 groups" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("saves a new template from an outline, showing its shape as it's typed", async () => {
    const dialog = mount(<GroupTemplatesDrawer open onOpenChange={vi.fn()} groups={GROUPS} />);
    fireEvent.click(await within(dialog()).findByRole("button", { name: "Save a new template" }));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Regional office" },
    });
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Groups" }), {
      target: { value: "Regional office\n  Regional Sales\n    Field" },
    });
    expect(within(dialog()).getByText("3 groups, 3 deep")).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save template" }));
    await waitFor(() =>
      expect(writes()).toEqual([
        {
          call: "POST /v1/groups/templates",
          body: {
            name: "Regional office",
            nodes: [
              {
                name: "Regional office",
                children: [{ name: "Regional Sales", children: [{ name: "Field", children: [] }] }],
              },
            ],
          },
        },
      ]),
    );
  });
});

describe("Import groups", () => {
  it("checks every row first, sends only the new ones, then says what wasn't made", async () => {
    const dialog = mount(<ImportGroupsDrawer open onOpenChange={vi.fn()} groups={GROUPS} />);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Or paste the rows instead" }));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Rows" }), {
      target: {
        value:
          'name,parent,description\nTreasury,Operations,"Cash, funding"\nPayments,Engineering,\nBrand,Marketing,\nData,,',
      },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Check the rows" }));
    expect(
      within(dialog()).getByText(
        "Pasted rows · 4 rows: 2 new · 1 already in the list · 1 can't be made",
      ),
    ).toBeTruthy();
    const brand = within(dialog()).getByText("Brand").closest("tr") as HTMLElement;
    expect(within(brand).getByText("Its parent isn't found")).toBeTruthy();
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog()).getByRole("button", { name: "Import 2 groups" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      call: "POST /v1/groups/import",
      body: {
        groups: [
          { name: "Treasury", parent: "Operations", description: "Cash, funding" },
          { name: "Data", parent: undefined, description: undefined },
        ],
      },
    });
    expect(await within(dialog()).findByText("1 made · 1 skipped · 2 not made")).toBeTruthy();
    const rows = within(within(dialog()).getByRole("table")).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Row"),
      expect.stringContaining("Payments"),
      expect.stringContaining("Brand"),
      expect.stringContaining("Data"),
    ]);
  });
});
