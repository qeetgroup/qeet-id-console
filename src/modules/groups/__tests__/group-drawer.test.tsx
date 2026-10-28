// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t-1", name: "Qeet Group" }] } }),
}));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (options: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(options);
        return run(options);
      };
    },
  };
});

// A native select stands in for the searchable combobox, which jsdom can't drive reliably.
vi.mock("@qeetrix/react/experimental", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@qeetrix/react/experimental")>()),
  Combobox: ({
    items,
    value,
    multiple,
    onValueChange,
  }: {
    items: { label: string; value: string }[];
    value: string | string[];
    multiple?: boolean;
    onValueChange: (v: string | string[] | null) => void;
  }) => (
    <select
      data-testid={multiple ? "people" : "place"}
      multiple={multiple}
      value={value}
      onChange={(e) =>
        onValueChange(
          multiple ? [...e.target.selectedOptions].map((o) => o.value) : e.target.value || null,
        )
      }
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
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { Group } from "../api/groups";
import { GroupDrawer, type GroupDrawerProps } from "../components/group-drawer";

const group = (id: string, name: string, parent: string | null = null, members = 1): Group => ({
  id,
  tenant_id: "t-1",
  parent_id: parent,
  name,
  description: "",
  created_at: "2025-08-18T10:00:00Z",
  member_count: members,
});
const GROUPS = [
  group("eng", "Engineering"),
  group("pay", "Payments", "eng", 5),
  group("cs", "Customer Success"),
  group("onb", "Onboarding", "cs", 4),
  group("sup", "Support", "cs", 1),
  group("ops", "Operations"),
];
const PEOPLE = [
  { id: "u-aditya", email: "aditya@qeet.in", display_name: "Aditya Hegde" },
  { id: "u-madhuri", email: "madhuri@qeet.in", display_name: "Madhuri Pillai" },
];

let createResult: () => Promise<unknown>;
beforeEach(() => {
  sensitiveCalls.length = 0;
  createResult = async () => ({ ...group("g-new", "Platform Security", "eng"), member_count: 0 });
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/roles" && method === "GET")
      return {
        items: [
          { id: "r-sa", name: "Security Analyst", description: "Investigates sign-in activity" },
        ],
      };
    if (path === "/v1/groups" && method === "POST") return createResult();
    if (/^\/v1\/groups\/g-new\/members\/u-/.test(path) && method === "POST") return undefined;
    if (path === "/v1/tenants/t-1/groups/g-new/roles/r-sa" && method === "POST") return undefined;
    if (path === "/v1/groups/cs" && method === "PATCH")
      return group("cs", "Customer Success", "ops");
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
}

function renderDrawer(props: Partial<GroupDrawerProps> = {}) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <GroupDrawer open onOpenChange={onOpenChange} groups={GROUPS} people={PEOPLE} {...props} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onOpenChange, dialog: () => screen.getByRole("dialog") };
}

const place = (id: string) =>
  fireEvent.change(screen.getByTestId("place"), { target: { value: id } });
function pick(...ids: string[]) {
  const select = screen.getByTestId("people") as HTMLSelectElement;
  for (const option of select.options) option.selected = ids.includes(option.value);
  fireEvent.change(select);
}

describe("the group drawer › new", () => {
  it("makes the group, adds its members, then grants its role through the step-up path", async () => {
    const { onOpenChange, dialog } = renderDrawer();
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Platform Security" },
    });
    place("eng");
    expect(
      within(dialog()).getByText("Where it sits: Engineering › Platform Security"),
    ).toBeTruthy();
    pick("u-aditya", "u-madhuri");
    expect(within(dialog()).getByText("2 people. You can add more from its page.")).toBeTruthy();

    fireEvent.mouseDown(within(dialog()).getByRole("combobox", { name: /Role/ }), { button: 0 });
    const role = await screen.findByRole("option", { name: "Security Analyst" });
    fireEvent.pointerDown(role, { pointerType: "mouse", button: 0 });
    fireEvent.click(role);
    expect(
      within(dialog()).getByText(
        "Security Analyst: Investigates sign-in activity. Its own members get it; people in the groups inside it don't.",
      ),
    ).toBeTruthy();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Create group" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(writes()).toEqual([
      "POST /v1/groups",
      "POST /v1/groups/g-new/members/u-aditya",
      "POST /v1/groups/g-new/members/u-madhuri",
      "POST /v1/tenants/t-1/groups/g-new/roles/r-sa",
    ]);
    expect(vi.mocked(api).mock.calls[1]?.[1]).toMatchObject({
      body: { tenant_id: "t-1", name: "Platform Security", parent_id: "eng" },
    });
    // Only the role grant is sensitive; making the group and adding members are not.
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "Grant the role to the new group" }),
    ]);
  });

  it("says a name is taken as it's typed, wherever that group sits, and waits", async () => {
    const { dialog } = renderDrawer();
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), {
      target: { value: " payments " },
    });
    expect(
      within(dialog()).getByText(
        "There's already a group called Payments, in Engineering. Names are unique in an organisation.",
      ),
    ).toBeTruthy();
    expect(
      within(dialog()).getByRole("button", { name: "Create group" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("asks for a name, and shows the server's own refusal on the field", async () => {
    const { dialog } = renderDrawer();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Create group" }));
    expect(await within(dialog()).findByText("Enter a name.")).toBeTruthy();

    createResult = async () => {
      throw new ApiError(409, "group.name_exists", "A group with that name already exists.");
    };
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Brand new" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Create group" }));
    expect(
      await within(dialog()).findByText(
        "There's already a group with that name. Names are unique in an organisation.",
      ),
    ).toBeTruthy();
  });

  it("opens inside a group, for Add a group inside", () => {
    const { dialog } = renderDrawer({ parentId: "cs" });
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Renewals" },
    });
    expect(within(dialog()).getByText("Where it sits: Customer Success › Renewals")).toBeTruthy();
  });
});

describe("the group drawer › edit", () => {
  it("moves a group with its groups, and never offers itself or its own groups as the place", async () => {
    const { onOpenChange, dialog } = renderDrawer({ group: GROUPS[2] });
    expect(screen.getByRole("heading", { name: "Edit Customer Success" })).toBeTruthy();
    expect(screen.queryByTestId("people")).toBeNull();
    const options = [...(screen.getByTestId("place") as HTMLSelectElement).options].map(
      (o) => o.textContent ?? "",
    );
    expect(options).toEqual(["At the top", "Engineering", "Engineering › Payments", "Operations"]);

    place("ops");
    expect(within(dialog()).getByText("Its 2 groups move with it")).toBeTruthy();
    expect(
      within(dialog()).getByText("Onboarding, Support stay inside Customer Success."),
    ).toBeTruthy();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(writes()).toEqual(["PATCH /v1/groups/cs"]);
    expect(vi.mocked(api).mock.calls.find(([p]) => p === "/v1/groups/cs")?.[1]).toMatchObject({
      body: { name: "Customer Success", description: "", parent_id: "ops" },
    });
  });
});
