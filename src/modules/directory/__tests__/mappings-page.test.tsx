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
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t1",
  useUserId: () => "u-me",
  useSessionId: () => "session-1",
}));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
const sensitiveCalls = vi.hoisted(
  () => [] as { actionLabel?: string; capability?: string; confirm?: unknown }[],
);
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
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/directory/attribute-mappings", searchStr: "", hash: "" }),
  useNavigate: () => navigate,
  useSearch: () => ({}),
  Link: ({
    to,
    search,
    params: _params,
    replace: _replace,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    search?: Record<string, string>;
    params?: unknown;
    replace?: boolean;
    children?: ReactNode;
  }) => {
    const query = search
      ? new URLSearchParams(
          Object.entries(search).filter((e): e is [string, string] => e[1] !== undefined),
        ).toString()
      : "";
    return (
      <a {...props} href={query ? `${to}?${query}` : to}>
        {children}
      </a>
    );
  },
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { MappingsPage } from "../components/mappings/mappings-page";
import type { MappingsFilters } from "../sync-search";
import { page, record } from "./fixtures";

const MAPPINGS = "/v1/tenants/t1/directory/connections/st/mappings";
const TARGETS = {
  email: "string",
  display_name: "string",
  first_name: "string",
  last_name: "string",
  department: "string",
  title: "string",
  manager_id: "string",
  groups: "array",
};
const department = {
  id: "m1",
  source_attribute: "departmentNumber",
  target_field: "department",
  value_type: "string",
  transform: "trim",
  pattern: "",
  enabled: true,
  required: false,
  version: 2,
};
const state = vi.hoisted(() => ({ mappings: [] as unknown[], connections: [] as unknown[] }));

beforeEach(() => {
  granted.except = new Set();
  navigate.mockReset();
  sensitiveCalls.length = 0;
  state.mappings = [];
  state.connections = [record()];
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t1/directory/connections") return { items: state.connections };
    if (path === "/v1/tenants/t1/ldap")
      return {
        items: [
          {
            id: "st",
            name: "Staging Directory (test)",
            base_dn: "ou=people,dc=staging,dc=qeet,dc=in",
            email_attribute: "mail",
            name_attribute: "cn",
          },
        ],
      };
    if (path === "/v1/tenants/t1/directory/errors")
      return page([], {
        summary: { open: 3, critical: 3, warning: 0, retried: 0, impacted_users: 0 },
        categories: [],
        connections: [],
        remediations: [],
      });
    if (path === MAPPINGS && method === "GET") return { items: state.mappings, targets: TARGETS };
    if (path === `${MAPPINGS}/preview`)
      return {
        profile: { department: "Engineering" },
        values: { m1: "Engineering" },
        issues: [],
        valid: true,
      };
    if (path === MAPPINGS && method === "POST") return { ...department, id: "m2", version: 1 };
    if (path.startsWith(`${MAPPINGS}/`)) return method === "DELETE" ? undefined : department;
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(filters: MappingsFilters = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onFiltersChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <MappingsPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => ({ call: `${options?.method} ${path}`, body: options?.body }));
const row = async (label: string) =>
  (await screen.findByText(label, { selector: "dt" })).closest(".account-detail") as HTMLElement;

describe("Directories › Mappings", () => {
  it("shows each field and what fills it: the connection's own email and name by default", async () => {
    renderPage();
    const base = await screen.findByText("ou=people,dc=staging,dc=qeet,dc=in", {
      selector: "code",
    });
    expect(base.parentElement?.textContent).toBe(
      "LDAP / AD · reads ou=people,dc=staging,dc=qeet,dc=in",
    );
    expect(
      within(await row("Email")).getByRole("button", { name: "Change the Email mapping" }),
    ).toBeTruthy();
    expect(
      screen.getByText("It's a draft: these mappings apply once it's turned on."),
    ).toBeTruthy();
    expect(within(await row("Email")).getByText("mail")).toBeTruthy();
    expect(within(await row("Email")).getByText(/doesn't change the email after/)).toBeTruthy();
    expect(within(await row("Display name")).getByText("cn")).toBeTruthy();
    expect(within(await row("First name")).getByText("Not mapped")).toBeTruthy();
    expect(within(await row("Group labels")).getByText(/don't add anyone to a group/)).toBeTruthy();
  });

  it("maps a field in place, saving through the step-up path without a confirm", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Map Department" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Directory attribute" }), {
      target: { value: "departmentNumber" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));
    await waitFor(() =>
      expect(writes()).toEqual([
        {
          call: `POST ${MAPPINGS}`,
          body: {
            source_attribute: "departmentNumber",
            target_field: "department",
            value_type: "string",
            transform: "none",
            pattern: "",
            enabled: true,
            required: false,
          },
        },
      ]),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "connection.write",
      actionLabel: "Save the mapping",
    });
  });

  it("refuses an LDAP attribute the server would, before sending it", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Map First name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Directory attribute" }), {
      target: { value: "/name/givenName" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));
    expect(
      await screen.findByText("The source attribute isn't a valid attribute name."),
    ).toBeTruthy();
    expect(writes()).toEqual([]);
  });

  it("changes a mapping with the version it read, and removes one only after the confirm", async () => {
    state.mappings = [department];
    renderPage();
    const dept = await row("Department");
    expect(within(dept).getByText("departmentNumber")).toBeTruthy();
    expect(within(dept).getByText("trimmed")).toBeTruthy();
    fireEvent.click(within(dept).getByRole("button", { name: "Change the Department mapping" }));
    fireEvent.click(screen.getByRole("button", { name: /Remove mapping/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove the Department mapping?")).toBeTruthy();
    expect(
      within(dialog).getByText(/People keep what it set\. From their next sign-in/),
    ).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove mapping" }));
    await waitFor(() =>
      expect(writes()).toEqual([{ call: `DELETE ${MAPPINGS}/m1`, body: undefined }]),
    );
  });

  it("tests an entry: the profile with the connection's defaults, and what isn't mapped", async () => {
    state.mappings = [department];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Run test/ }));
    await waitFor(() => expect(writes().map((w) => w.call)).toEqual([`POST ${MAPPINGS}/preview`]));
    expect(writes()[0]?.body).toMatchObject({
      source: { uid: "ananya.iyer", mail: "ananya.iyer@example.com" },
    });
    const result = (await screen.findByText("The profile it makes")).closest(
      "section",
    ) as HTMLElement;
    expect(within(result).getByText("Valid")).toBeTruthy();
    expect(within(result).getByText("ananya.iyer@example.com")).toBeTruthy();
    expect(within(result).getAllByText(/from the connection's settings/)).toHaveLength(2);
    expect(within(result).getByText("Engineering")).toBeTruthy();
    expect(within(result).getByText("uid, givenName, sn, title")).toBeTruthy();
  });

  it("asks for one JSON object before asking the server", async () => {
    renderPage();
    fireEvent.change(await screen.findByRole("textbox", { name: "Directory entry (JSON)" }), {
      target: { value: "[1, 2]" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Run test/ }));
    expect(await screen.findByText("Enter one JSON object, under 64 KB.")).toBeTruthy();
    expect(writes()).toEqual([]);
  });

  it("switches to another connection through the address", async () => {
    state.connections = [
      record(),
      record({ id: "scim:t1", type: "scim", name: "SCIM", status: "configured", server_url: null }),
    ];
    const { onFiltersChange } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Switch/ }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "SCIM provisioning" }));
    expect(onFiltersChange).toHaveBeenCalledWith({ connection: "scim:t1" });
  });

  it("offers no changes to someone who can only look", async () => {
    granted.except = new Set(["connection.write"]);
    renderPage();
    await row("Email");
    expect(screen.queryByRole("button", { name: /^Map / })).toBeNull();
    expect(screen.getByText("You can see the mappings, not change them")).toBeTruthy();
  });
});
