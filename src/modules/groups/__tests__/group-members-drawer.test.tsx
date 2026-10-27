// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
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
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t-1", name: "Qeet Group" }] } }),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toasts.success, error: vi.fn(), warning: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; params?: { groupId: string }; children?: ReactNode }) => (
    <a {...props} href={to.replace("$groupId", params?.groupId ?? "")}>
      {children}
    </a>
  ),
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
    value: string[];
    onValueChange: (v: string[]) => void;
  }) => (
    <select
      data-testid="people"
      multiple
      value={value}
      onChange={(e) => onValueChange([...e.target.selectedOptions].map((o) => o.value))}
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
import type { Group } from "../api/groups";
import {
  GroupMembersDrawer,
  type GroupMembersDrawerProps,
} from "../components/group-members-drawer";

const group = (id: string, name: string, members: number): Group => ({
  id,
  tenant_id: "t-1",
  parent_id: null,
  name,
  description: "",
  created_at: "2025-08-18T10:00:00Z",
  member_count: members,
});
const PEOPLE = [
  { id: "u-aditya", email: "aditya@qeet.in", display_name: "Aditya Hegde", status: "active" },
  { id: "u-sowmya", email: "sowmya@qeet.in", display_name: "Sowmya Bose", status: "suspended" },
  { id: "u-tara", email: "tara@qeet.in", display_name: "Tara Menon", status: "active" },
  { id: "u-kabir", email: "kabir@qeet.in", display_name: "Kabir Fernandes", status: "active" },
];
let members: Record<string, { user_id: string; email: string; display_name: string }[]>;
let failAdd: Set<string>;

beforeEach(() => {
  toasts.success.mockReset();
  failAdd = new Set();
  members = {
    sre: [
      { user_id: "u-aditya", email: "aditya@qeet.in", display_name: "Aditya Hegde" },
      { user_id: "u-sowmya", email: "sowmya@qeet.in", display_name: "Sowmya Bose" },
    ],
    grc: [],
  };
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    const list = /^\/v1\/groups\/(\w+)\/members$/.exec(path);
    if (list && method === "GET") return { items: members[list[1] ?? ""] ?? [] };
    const one = /^\/v1\/groups\/(\w+)\/members\/([\w-]+)$/.exec(path);
    if (one && method === "POST") {
      if (failAdd.has(one[2] ?? "")) throw new Error("no");
      return undefined;
    }
    if (one && method === "DELETE") return undefined;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderDrawer(props: Partial<GroupMembersDrawerProps> & { group: Group }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <GroupMembersDrawer
          onClose={vi.fn()}
          path={["Engineering", props.group.name]}
          people={PEOPLE}
          {...props}
        />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { dialog: () => screen.getByRole("dialog") };
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, o]) => (o?.method ?? "GET") !== "GET")
    .map(([p, o]) => `${o?.method} ${p}`);
function pick(...ids: string[]) {
  const select = screen.getByTestId("people") as HTMLSelectElement;
  for (const option of select.options) option.selected = ids.includes(option.value);
  fireEvent.change(select);
}

describe("the members drawer", () => {
  it("says where the group sits and what it grants, and lists who's in it", async () => {
    const { dialog } = renderDrawer({ group: group("sre", "Site Reliability", 2), grants: [] });
    expect(
      within(dialog()).getByText(
        "Engineering › Site Reliability. It grants no roles yet; grant them on its page.",
      ),
    ).toBeTruthy();
    expect(await within(dialog()).findByText("2 members")).toBeTruthy();
    const sowmya = within(dialog()).getByText("Sowmya Bose").closest("li") as HTMLElement;
    expect(within(sowmya).getByText("Suspended")).toBeTruthy();
    // Members already in it aren't offered again.
    const offered = [...(screen.getByTestId("people") as HTMLSelectElement).options].map(
      (o) => o.textContent,
    );
    expect(offered).toEqual(["Tara Menon", "Kabir Fernandes"]);
    expect(within(dialog()).getByRole("link", { name: "Open its page" }).getAttribute("href")).toBe(
      "/groups/sre",
    );
  });

  it("adds the chosen people together, with one toast, and keeps any that failed chosen", async () => {
    failAdd = new Set(["u-kabir"]);
    const { dialog } = renderDrawer({
      group: group("grc", "Governance", 0),
      grants: ["Auditor"],
    });
    expect(
      await within(dialog()).findByText(
        "So the Auditor role it grants reaches no one. Add people above.",
      ),
    ).toBeTruthy();
    pick("u-tara", "u-kabir");
    expect(
      within(dialog()).getByText("2 people. They'll get Auditor through Governance."),
    ).toBeTruthy();
    members.grc = [{ user_id: "u-tara", email: "tara@qeet.in", display_name: "Tara Menon" }];
    fireEvent.click(within(dialog()).getByRole("button", { name: "Add 2 people" }));

    expect(await within(dialog()).findByText("Couldn't add Kabir Fernandes")).toBeTruthy();
    expect(writes()).toEqual([
      "POST /v1/groups/grc/members/u-tara",
      "POST /v1/groups/grc/members/u-kabir",
    ]);
    expect(toasts.success).toHaveBeenCalledWith("1 person added to Governance");
    const tara = (
      await within(dialog()).findByText("Tara Menon", { selector: "*:not(option)" })
    ).closest("li") as HTMLElement;
    expect(within(tara).getByText("Added")).toBeTruthy();
    expect(within(dialog()).getByRole("button", { name: "Add 1 person" })).toBeTruthy();
  });

  it("removes someone after the confirm says what they lose", async () => {
    const { dialog } = renderDrawer({
      group: group("sre", "Site Reliability", 2),
      grants: ["Developer"],
    });
    fireEvent.click(
      await within(dialog()).findByRole("button", {
        name: "Remove Aditya Hegde from Site Reliability",
      }),
    );
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain("Remove Aditya Hegde from Site Reliability?");
    expect(confirm.textContent).toContain(
      "They stay in Qeet Group and keep the roles given to them directly. They lose Developer, unless another group or their own roles give it to them.",
    );
    fireEvent.click(within(confirm).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/groups/sre/members/u-aditya"]));
  });
});
