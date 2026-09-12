// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/modules/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/users")>()),
  useUserStats: vi.fn(),
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/directory/connections" }),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));

import type { DirectoryConnection } from "../directory-model";
import { ConnectionsView } from "../components/connections-page";
import { SyncActivityView } from "../components/sync-activity-page";
import { SyncErrorsView } from "../components/sync-errors-page";
import { MappingEditor, MappingsView } from "../components/mappings-page";
import type { DirectoryMappings } from "../api/directory";
import { parseMappingSource } from "../directory-model";
import { DEFAULT_ERROR_FILTERS, type DirectoryErrorPage } from "../api/directory";
import {
  DEFAULT_EVENT_FILTERS,
  type DirectoryEventPage,
  fetchDirectoryExport,
} from "../api/directory";
import { api } from "@/platform/api/client";
import {
  DEFAULT_SUSPENDED_FILTERS,
  fetchSuspendedExport,
  safeSuspendedCsvValue,
  type SuspendedUsersPage,
} from "@/modules/users";
import { SuspendedView, SuspensionReviewDialog } from "../components/suspended-page";

function connections(): DirectoryConnection[] {
  return [
    {
      id: "scim:tenant-a",
      name: "SCIM",
      reference: "/scim/v2",
      type: "scim",
      status: "configured",
      health: "unknown",
      environment: null,
      scope: "users-and-groups",
      createdAt: null,
      lastActivityAt: null,
      lastSyncAt: null,
      userCount: 80,
      groupCount: null,
      serverUrl: null,
    },
    {
      id: "ldap-a",
      name: "Corporate directory",
      reference: "ldap-a",
      type: "ldap",
      status: "active",
      health: "unknown",
      environment: null,
      scope: "users-on-signin",
      createdAt: null,
      lastActivityAt: null,
      lastSyncAt: null,
      userCount: null,
      groupCount: null,
      serverUrl: "ldaps://directory.example.test",
    },
  ];
}

const props = () => ({
  connections: connections(),
  loading: false,
  error: false,
  busy: false,
  retry: vi.fn(),
  canWrite: true,
  totalUsers: 100,
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe("Connections page", () => {
  it.each(["light", "dark"])(
    "renders the reference structure with the same content in %s",
    (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      render(<ConnectionsView {...props()} />);
      expect(screen.getByRole("heading", { name: "All connections" })).toBeTruthy();
      expect(screen.getAllByRole("article")).toHaveLength(5);
      expect(screen.getByRole("table")).toBeTruthy();
      expect(screen.getByRole("region", { name: "Connection health" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Provisioning coverage" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Recent sync events" })).toBeTruthy();
      expect(screen.getByText("80%")).toBeTruthy();
      expect(screen.queryByText("Production")).toBeNull();
      expect(screen.getByRole("article", { name: "Healthy" }).textContent).toContain(
        "Not reported",
      );
    },
  );

  it("searches and clears filters without changing the global summary", () => {
    render(<ConnectionsView {...props()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search connections..." }), {
      target: { value: "Corporate" },
    });
    expect(within(screen.getByRole("table")).queryByRole("link", { name: "SCIM" })).toBeNull();
    expect(screen.getByRole("link", { name: "Corporate directory" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Total connections" }).textContent).toContain("2");
    fireEvent.change(screen.getByRole("textbox", { name: "Search connections..." }), {
      target: { value: "missing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("link", { name: "SCIM" })).toBeTruthy();
  });

  it("filters by connection type using the menu", async () => {
    render(<ConnectionsView {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "LDAP / AD" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Corporate directory" })).toBeTruthy();
  });

  it("offers supported creation destinations only to writers", async () => {
    const state = props();
    const { rerender } = render(<ConnectionsView {...state} />);
    fireEvent.click(screen.getByRole("button", { name: "Add connection" }));
    expect((await screen.findByRole("menuitem", { name: "SCIM" })).getAttribute("href")).toBe(
      "/auth/connections/scim",
    );
    rerender(<ConnectionsView {...state} canWrite={false} />);
    expect(screen.queryByRole("button", { name: "Add connection" })).toBeNull();
  });

  it("reports a failed request without showing a fabricated zero total", () => {
    const state = props();
    render(<ConnectionsView {...state} connections={undefined} error />);
    expect(screen.getByRole("article", { name: "Total connections" }).textContent).toContain(
      "Not reported",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.retry).toHaveBeenCalledOnce();
  });
});

function activityFixture(): DirectoryEventPage {
  return {
    items: [
      {
        id: "event-a",
        connection_id: "scim:tenant-a",
        operation: "post",
        trigger: "push",
        resource_type: "user",
        resource_id: "",
        started_at: "2026-09-12T10:00:00Z",
        duration_ms: 1300,
        http_status: 201,
        status: "success",
        users_synced: 1,
        groups_synced: 0,
        error_code: "",
        message: "Operation completed",
        category: "",
        severity: "",
        resolution: "open",
        resolved_at: null,
        retry_of: null,
        retryable: false,
      },
    ],
    total: 48,
    limit: 25,
    offset: 0,
    summary: { total: 48, successful: 42, warnings: 4, failed: 2, average_duration_ms: 138000 },
    volume: [{ date: "2026-09-12", users: 42, groups: 8 }],
  };
}

function activityProps() {
  return {
    page: activityFixture(),
    connections: connections(),
    filters: DEFAULT_EVENT_FILTERS,
    onFiltersChange: vi.fn(),
    loading: false,
    error: false,
    busy: false,
    retry: vi.fn(),
    canWrite: true,
    onCreateAlert: vi.fn(),
    onExport: vi.fn(),
    exporting: false,
  };
}

describe("Sync activity page", () => {
  it.each(["light", "dark"])("keeps the same operations and controls in %s mode", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    render(<SyncActivityView {...activityProps()} />);
    expect(screen.getByRole("heading", { name: "Sync activity" })).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getByRole("article", { name: "Average duration" }).textContent).toContain(
      "2m 18s",
    );
    expect(screen.getByRole("region", { name: "Sync volume" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Latest operation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export log" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create alert" })).toBeTruthy();
  });

  it("resets paging on a filter change and keeps pagination scoped to those filters", () => {
    const state = activityProps();
    render(<SyncActivityView {...state} filters={{ ...state.filters, offset: 25 }} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search sync activity..." }), {
      target: { value: "provision" },
    });
    expect(state.onFiltersChange).toHaveBeenCalledWith({
      ...state.filters,
      q: "provision",
      offset: 0,
    });
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(state.onFiltersChange).toHaveBeenLastCalledWith({ ...state.filters, offset: 0 });
  });

  it("opens details for the selected operation and invokes export and alert actions", async () => {
    const state = activityProps();
    render(<SyncActivityView {...state} />);
    fireEvent.click(screen.getByRole("button", { name: "Export log" }));
    fireEvent.click(screen.getByRole("button", { name: "Create alert" }));
    expect(state.onExport).toHaveBeenCalledOnce();
    expect(state.onCreateAlert).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "View operation for SCIM" }));
    expect(await screen.findByRole("dialog", { name: "Operation details" })).toBeTruthy();
  });

  it("does not show healthy-looking totals when the activity query fails", () => {
    const state = activityProps();
    render(<SyncActivityView {...state} page={undefined} error canWrite={false} />);
    expect(screen.getByRole("article", { name: "Successful operations" }).textContent).toContain(
      "Not reported",
    );
    expect(screen.queryByRole("button", { name: "Create alert" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export log" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.retry).toHaveBeenCalledOnce();
  });

  it("exports every filtered page rather than just the visible table rows", async () => {
    const first = activityFixture();
    vi.mocked(api).mockResolvedValueOnce({ ...first, total: 2 });
    vi.mocked(api).mockResolvedValueOnce({
      ...first,
      total: 2,
      items: [{ ...first.items[0], id: "event-b" }],
    });
    const records = await fetchDirectoryExport("tenant-a", DEFAULT_EVENT_FILTERS);
    expect(records.map((record) => record.id)).toEqual(["event-a", "event-b"]);
    expect(api).toHaveBeenLastCalledWith(
      "/v1/tenants/tenant-a/directory/activity",
      expect.objectContaining({ query: { ...DEFAULT_EVENT_FILTERS, limit: 100, offset: 100 } }),
    );
  });
});

function errorFixture(): DirectoryErrorPage {
  const event = activityFixture().items[0];
  return {
    items: [
      {
        ...event,
        id: "error-a",
        status: "failed",
        error_code: "DIR-409",
        message: "An identity or group already exists",
        category: "provisioning",
        severity: "warning",
      },
      {
        ...event,
        id: "error-b",
        connection_id: "ldap-a",
        operation: "test",
        resource_type: "connection",
        status: "failed",
        error_code: "DIR-502",
        message: "The directory operation could not be completed",
        category: "connection",
        severity: "critical",
        retryable: true,
      },
    ],
    total: 2,
    limit: 25,
    offset: 0,
    summary: { open: 2, critical: 1, warning: 1, retried: 0, impacted_users: null },
    categories: [
      { key: "provisioning", count: 1 },
      { key: "connection", count: 1 },
    ],
    connections: [
      { key: "scim:tenant-a", count: 1 },
      { key: "ldap-a", count: 1 },
    ],
    remediations: [],
  };
}

function errorProps() {
  return {
    page: errorFixture(),
    connections: connections(),
    filters: DEFAULT_ERROR_FILTERS,
    onFiltersChange: vi.fn(),
    loading: false,
    busy: false,
    error: false,
    retry: vi.fn(),
    canWrite: true,
    onAction: vi.fn(),
    acting: false,
    onExport: vi.fn(),
    exporting: false,
  };
}

describe("Sync errors page", () => {
  it.each(["light", "dark"])(
    "renders the same error metrics and remediation panels in %s",
    (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      render(<SyncErrorsView {...errorProps()} />);
      expect(screen.getAllByRole("article")).toHaveLength(5);
      expect(screen.getByRole("article", { name: "Open errors" }).textContent).toContain("2");
      expect(screen.getByRole("article", { name: "Impacted users" }).textContent).toContain(
        "Not reported",
      );
      expect(screen.getByRole("region", { name: "Error categories" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Most affected connections" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Recent remediation activity" })).toBeTruthy();
    },
  );

  it("retries only eligible visible LDAP checks, not provider pushes", () => {
    const state = errorProps();
    render(<SyncErrorsView {...state} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry failed checks" }));
    expect(state.onAction).toHaveBeenCalledWith([state.page.items[1]], "retry");
  });

  it("shows provider retry guidance and supports resolving a selected error", async () => {
    const state = errorProps();
    render(<SyncErrorsView {...state} />);
    fireEvent.click(screen.getByRole("button", { name: "View error DIR-409" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Error details" }));
    expect(dialog.getByText(/must be retried at their source/)).toBeTruthy();
    expect(dialog.queryByRole("button", { name: "Retry check" })).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "Mark resolved" }));
    expect(state.onAction).toHaveBeenCalledWith([state.page.items[0]], "resolve");
  });

  it("hides remediation writes for read-only access", async () => {
    render(<SyncErrorsView {...errorProps()} canWrite={false} />);
    expect(screen.queryByRole("button", { name: "Retry failed checks" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View error DIR-502" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Error details" }));
    expect(dialog.queryByRole("button", { name: "Mark resolved" })).toBeNull();
    expect(dialog.queryByRole("button", { name: "Retry check" })).toBeNull();
  });

  it("resets paging when the error search changes", () => {
    const state = errorProps();
    render(<SyncErrorsView {...state} />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search errors by message, code or ID..." }),
      { target: { value: "DIR-502" } },
    );
    expect(state.onFiltersChange).toHaveBeenCalledWith({
      ...state.filters,
      q: "DIR-502",
      offset: 0,
    });
  });
});

function mappingsFixture(): DirectoryMappings {
  return {
    items: [
      {
        id: "mapping-a",
        source_attribute: "department",
        target_field: "department",
        value_type: "string",
        transform: "uppercase",
        pattern: "",
        enabled: true,
        required: true,
        version: 1,
      },
    ],
    targets: { department: "string", groups: "array" },
  };
}

function mappingProps() {
  return {
    data: mappingsFixture(),
    connection: connections()[0],
    connections: connections(),
    onConnectionChange: vi.fn(),
    loading: false,
    error: false,
    retry: vi.fn(),
    canWrite: true,
    busy: false,
    source: '{"department":"engineering"}',
    onSourceChange: vi.fn(),
    preview: {
      valid: true,
      profile: { department: "ENGINEERING" },
      values: { "mapping-a": "ENGINEERING" },
      issues: [],
    },
    onPreview: vi.fn(),
    previewing: false,
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggle: vi.fn(),
  };
}

describe("Mappings page", () => {
  it.each(["light", "dark"])("keeps the rule table and preview aligned in %s", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    render(<MappingsView {...mappingProps()} />);
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Mapped Qeet ID profile" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Required fields covered" }).textContent).toContain(
      "1/1",
    );
    expect(screen.getByRole("status").textContent).toContain("Mapping valid");
    expect(screen.getByRole("textbox", { name: "Source data (JSON)" })).toBeTruthy();
  });

  it("does not claim a valid mapping before a current preview exists", () => {
    render(<MappingsView {...mappingProps()} preview={undefined} />);
    expect(screen.getByRole("status").textContent).toBe("Not validated");
    expect(screen.queryByText("Mapping valid")).toBeNull();
  });

  it("supports source editing, testing, rule actions, and selected deletion", async () => {
    const state = mappingProps();
    render(<MappingsView {...state} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Source data (JSON)" }), {
      target: { value: '{"department":"product"}' },
    });
    expect(state.onSourceChange).toHaveBeenCalledWith('{"department":"product"}');
    fireEvent.click(screen.getByRole("button", { name: "Test data" }));
    expect(state.onPreview).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Actions for department mapping" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Disable" }));
    expect(state.onToggle).toHaveBeenCalledWith(state.data.items[0]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select department mapping" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(state.onDelete).toHaveBeenCalledWith(state.data.items);
  });

  it("hides write controls and selection for read-only access", () => {
    render(<MappingsView {...mappingProps()} canWrite={false} />);
    expect(screen.queryByRole("button", { name: "Add mapping" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Actions for department mapping" })).toBeNull();
    expect(screen.getByRole("button", { name: "Test mapping" })).toBeTruthy();
  });

  it("edits a rule while retaining its optimistic version", () => {
    const state = mappingProps();
    const save = vi.fn();
    render(
      <MappingEditor
        initial={state.data.items[0]}
        targets={state.data.targets}
        busy={false}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Source attribute" }), {
      target: { value: "division" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));
    expect(save).toHaveBeenCalledWith({ ...state.data.items[0], source_attribute: "division" });
  });

  it("rejects oversized and non-object JSON before preview requests", () => {
    expect(parseMappingSource('{"department":"Engineering"}')).toEqual({
      department: "Engineering",
    });
    for (const input of [
      "[]",
      "null",
      "true",
      "invalid",
      JSON.stringify({ value: "x".repeat(64000) }),
    ]) {
      expect(() => parseMappingSource(input)).toThrow();
    }
  });
});

function suspendedFixture(): SuspendedUsersPage {
  const managed = {
    id: "user-a",
    email: "priya@example.test",
    display_name: "Priya Sharma",
    avatar_url: null,
    team: "Engineering",
    reason: "policy_violation",
    source: "manual",
    risk: "high" as const,
    review: "pending" as const,
    suspended_at: "2026-09-10T12:00:00Z",
    last_sign_in: "2026-09-09T12:00:00Z",
    can_manage: true,
  };
  return {
    items: [
      managed,
      {
        ...managed,
        id: "user-external",
        email: "sam@example.test",
        display_name: "Sam Rivera",
        reason: "managed_elsewhere",
        source: "external",
        risk: "unknown",
        review: "external",
        suspended_at: null,
        last_sign_in: null,
        can_manage: false,
      },
      { ...managed, id: "user-self", display_name: "Current operator" },
    ],
    total: 3,
    limit: 25,
    offset: 0,
    summary: { total: 3, high_risk: 2, policy: 0, manual: 2, pending: 2 },
    reasons: [
      { key: "policy_violation", count: 2 },
      { key: "managed_elsewhere", count: 1 },
    ],
    risks: [
      { key: "high", count: 2 },
      { key: "unknown", count: 1 },
    ],
    queue: [managed],
    teams: ["Engineering"],
  };
}

function suspendedProps() {
  return {
    page: suspendedFixture(),
    filters: DEFAULT_SUSPENDED_FILTERS,
    onFiltersChange: vi.fn(),
    loading: false,
    error: false,
    busy: false,
    retry: vi.fn(),
    canWrite: true,
    canReviewPolicy: true,
    currentUserId: "user-self",
    onReactivate: vi.fn(),
    onReview: vi.fn(),
    acting: false,
    onExport: vi.fn(),
    exporting: false,
  };
}

describe("Suspended users page", () => {
  it.each(["light", "dark"])("keeps the same content and controls in %s mode", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    render(<SuspendedView {...suspendedProps()} />);
    expect(screen.getByRole("heading", { name: "Suspended users", level: 1 })).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Suspension reasons" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Reactivation queue" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Risk distribution" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export list" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review policies" }).getAttribute("href")).toBe(
      "/settings/organization/security-policy",
    );
  });

  it("selects only manageable users and excludes the current operator", () => {
    const state = suspendedProps();
    render(<SuspendedView {...state} />);
    expect(
      screen.getByRole("checkbox", { name: "Select Sam Rivera" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "Select Current operator" }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select eligible users" }));
    fireEvent.click(screen.getByRole("button", { name: "Reactivate 1 selected" }));
    expect(state.onReactivate).toHaveBeenCalledWith([state.page.items[0]]);
    expect(screen.queryByRole("button", { name: "Actions for Sam Rivera" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Actions for Current operator" })).toBeNull();
  });

  it("offers review and reactivation only for the selected manageable user", async () => {
    const state = suspendedProps();
    render(<SuspendedView {...state} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Priya Sharma" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Review suspension" }));
    expect(state.onReview).toHaveBeenCalledWith(state.page.items[0]);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Priya Sharma" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reactivate" }));
    expect(state.onReactivate).toHaveBeenCalledWith([state.page.items[0]]);
  });

  it("hides write controls for readers and disables them during a mutation", () => {
    const state = suspendedProps();
    const { rerender } = render(
      <SuspendedView {...state} canWrite={false} canReviewPolicy={false} />,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Actions for Priya Sharma" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Review policies" })).toBeNull();
    rerender(<SuspendedView {...state} acting />);
    expect(
      screen.getByRole("checkbox", { name: "Select eligible users" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Actions for Priya Sharma" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("resets pagination for search and pending-review filters and invokes export", () => {
    const state = suspendedProps();
    render(<SuspendedView {...state} filters={{ ...state.filters, offset: 25 }} />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search users by name, email or ID..." }),
      {
        target: { value: "Priya" },
      },
    );
    expect(state.onFiltersChange).toHaveBeenCalledWith({ ...state.filters, q: "Priya", offset: 0 });
    fireEvent.click(screen.getByRole("button", { name: "View all 2 pending" }));
    expect(state.onFiltersChange).toHaveBeenLastCalledWith({
      ...state.filters,
      review: "pending",
      offset: 0,
    });
    fireEvent.click(screen.getByRole("button", { name: "Export list" }));
    expect(state.onExport).toHaveBeenCalledOnce();
  });

  it("keeps unknown summaries distinct from zero or no pending reviews when loading fails", () => {
    const state = suspendedProps();
    render(<SuspendedView {...state} page={undefined} error />);
    expect(screen.getByRole("article", { name: "Total suspended" }).textContent).toContain(
      "Not reported",
    );
    expect(screen.getByRole("button", { name: "Export list" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("No pending reviews.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.retry).toHaveBeenCalledOnce();
  });

  it("saves a review without silently reactivating the user", () => {
    const save = vi.fn();
    const user = suspendedFixture().items[0];
    const { rerender } = render(
      <SuspensionReviewDialog user={user} busy={false} onSave={save} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    expect(save).toHaveBeenCalledWith({
      reason: "policy_violation",
      risk: "high",
      review: "pending",
    });
    rerender(<SuspensionReviewDialog user={user} busy onSave={save} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save review" }).hasAttribute("disabled")).toBe(true);
  });

  it("exports every filtered page and protects spreadsheet cells from formulas", async () => {
    const page = suspendedFixture();
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValueOnce({ ...page, total: 2, items: [page.items[0]] });
    vi.mocked(api).mockResolvedValueOnce({ ...page, total: 2, items: [page.items[1]] });
    const rows = await fetchSuspendedExport({ ...DEFAULT_SUSPENDED_FILTERS, risk: "high" });
    expect(rows.map((user) => user.id)).toEqual(["user-a", "user-external"]);
    expect(api).toHaveBeenLastCalledWith(
      "/v1/users/suspended",
      expect.objectContaining({
        query: { ...DEFAULT_SUSPENDED_FILTERS, risk: "high", limit: 100, offset: 100 },
      }),
    );
    for (const value of ["=CMD()", "+1", "@SUM(A1)", "-2", "  =1", "\tformula"]) {
      expect(safeSuspendedCsvValue(value)).toBe(`'${value}`);
    }
    expect(safeSuspendedCsvValue("Priya Sharma")).toBe("Priya Sharma");
    expect(safeSuspendedCsvValue(null)).toBe("");
  });
});
