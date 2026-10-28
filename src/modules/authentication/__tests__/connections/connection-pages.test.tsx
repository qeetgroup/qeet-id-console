// @vitest-environment jsdom
// The connection pages and every pop-up they open: what each shows from the server's records, and
// that each write goes through the console's one confirm (when it changes what people can do) and
// the sensitive-action path, sending what the server takes.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
  getApiBaseUrl: () => "https://id.example.com",
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t1",
  useUserId: () => "u-me",
  useSessionId: () => "session-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: undefined }),
  FeatureGate: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t1", name: "Qeet Group" }] } }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
const nav = vi.hoisted(() => ({ navigate: vi.fn(), redirects: [] as unknown[] }));
vi.mock("@tanstack/react-router", () => {
  const href = (to: string, params?: Record<string, string>, search?: Record<string, string>) => {
    let path = to;
    for (const [k, v] of Object.entries(params ?? {})) path = path.replace(`$${k}`, v);
    const query = search ? new URLSearchParams(search).toString() : "";
    return query ? `${path}?${query}` : path;
  };
  return {
    useLocation: () => ({ pathname: "/auth/connections/saml", searchStr: "", hash: "" }),
    useNavigate: () => nav.navigate,
    useSearch: () => ({}),
    Navigate: (props: unknown) => {
      nav.redirects.push(props);
      return null;
    },
    Link: ({
      to,
      params,
      search,
      hash: _hash,
      children,
      ...props
    }: ComponentProps<"a"> & {
      to: string;
      params?: Record<string, string>;
      search?: Record<string, string>;
      hash?: string;
    }) => (
      <a {...props} href={href(to, params, search)}>
        {children}
      </a>
    ),
  };
});
// Records each sensitive action's options while the real provider confirms and runs it.
const sensitive = vi.hoisted(() => ({ calls: [] as SensitiveActionOptions<unknown>[] }));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return <T,>(options: SensitiveActionOptions<T>) => {
        sensitive.calls.push(options as SensitiveActionOptions<unknown>);
        return run(options);
      };
    },
  };
});

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { SsoListPage } from "@/modules/authentication/components/connections/sso-list-page";
import { LdapConnectionPage } from "@/modules/authentication/components/ldap/ldap-connection-page";
import { LdapIndexPage } from "@/modules/authentication/components/ldap/ldap-index-page";
import { OidcAppPage } from "@/modules/authentication/components/oidc/oidc-app-page";
import { OidcAppsPage } from "@/modules/authentication/components/oidc/oidc-apps-page";
import { SamlAppsPage } from "@/modules/authentication/components/saml/saml-apps-page";
import { SamlConnectionPage } from "@/modules/authentication/components/saml/saml-connection-page";
import { ScimPage } from "@/modules/authentication/components/scim/scim-page";
import { OKTA_CERT } from "./fixtures";

const T = "/v1/tenants/t1";
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const SAML = {
  id: "s1",
  tenant_id: "t1",
  name: "Okta",
  idp_entity_id: "http://www.okta.com/exk1",
  idp_sso_url: "https://acme.okta.com/app/sso/saml",
  idp_certificate: OKTA_CERT,
  email_attribute: "email",
  name_attribute: "name",
  status: "active",
  allow_idp_initiated: false,
  created_at: ago(300),
  updated_at: ago(300),
  last_login_at: ago(1),
};
const LDAP = {
  id: "l1",
  tenant_id: "t1",
  name: "Staging Directory (test)",
  server_url: "ldaps://ldap.staging.qeet.in:636",
  start_tls: false,
  skip_tls_verify: false,
  bind_dn: "cn=svc-qeet-id,ou=service,dc=staging,dc=qeet,dc=in",
  base_dn: "ou=people,dc=staging,dc=qeet,dc=in",
  user_filter: "(uid=%s)",
  email_attribute: "mail",
  name_attribute: "cn",
  status: "draft",
  created_at: ago(20),
  updated_at: ago(20),
  last_login_at: null,
};
const APP = {
  id: "a1",
  tenant_id: "t1",
  name: "Slack",
  entity_id: "https://slack.com",
  acs_url: "https://acme.slack.com/sso/saml",
  name_id_format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  name_id_attribute: "email",
  certificate: "",
  status: "active",
  created_at: ago(60),
  updated_at: ago(60),
  last_login_at: ago(2),
};
const CLIENT = {
  id: "c1",
  tenant_id: "t1",
  client_id: "qci_support",
  name: "Support Desk",
  type: "confidential",
  redirect_uris: ["https://support.qeet.in/callback"],
  post_logout_uris: ["https://support.qeet.in/"],
  grant_types: ["authorization_code", "refresh_token"],
  scopes: ["openid", "profile", "email"],
  created_at: ago(370),
  pkce_exempt_until: new Date(Date.now() + 40 * DAY).toISOString(),
};
const event = (over: Record<string, unknown>) => ({
  id: "e1",
  connection_id: "l1",
  operation: "test",
  trigger: "manual",
  resource_type: "connection",
  resource_id: "",
  started_at: ago(8),
  duration_ms: 12000,
  http_status: 502,
  status: "failed",
  users_synced: 0,
  groups_synced: 0,
  error_code: "DIR-502",
  message: "ldaps://ldap.staging.qeet.in:636: no such host",
  category: "connection",
  severity: "critical",
  resolution: "open",
  resolved_at: null,
  retry_of: null,
  retryable: true,
  ...over,
});
const eventPage = (items: unknown[]) => ({
  items,
  total: items.length,
  limit: 100,
  offset: 0,
  summary: {
    total: items.length,
    successful: 0,
    warnings: 0,
    failed: items.length,
    average_duration_ms: null,
  },
  volume: [],
});

type Handler = (method: string, body: unknown, query: Record<string, unknown>) => unknown;
let routes: Record<string, Handler>;
const state = vi.hoisted(() => ({
  scimSet: false,
  clients: [] as unknown[],
  saml: [] as unknown[],
  ldap: [] as unknown[],
}));

beforeEach(() => {
  sensitive.calls = [];
  nav.navigate.mockReset();
  nav.redirects = [];
  state.scimSet = false;
  state.clients = [
    CLIENT,
    {
      ...CLIENT,
      id: "c2",
      client_id: "qci_cli",
      name: "Qeet CLI",
      type: "public",
      redirect_uris: [],
      grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
      pkce_exempt_until: null,
    },
  ];
  state.saml = [SAML];
  state.ldap = [LDAP];
  routes = {
    [`${T}/saml`]: (m, body) =>
      m === "GET" ? { items: state.saml } : { ...SAML, id: "s2", ...(body as object) },
    [`${T}/saml/s1`]: (_m, body) => ({ ...SAML, ...(body as object) }),
    [`${T}/saml/s1/test`]: () => ({
      ok: true,
      checks: [
        { name: "IdP entity ID", ok: true },
        { name: "IdP SSO URL", ok: true },
        { name: "Signing certificate", ok: true },
        { name: "Certificate validity period", ok: true, detail: "Valid until 2036-10-25." },
        { name: "Email attribute mapping", ok: true },
      ],
    }),
    [`${T}/ldap`]: (m, body) =>
      m === "GET" ? { items: state.ldap } : { ...LDAP, id: "l2", ...(body as object) },
    [`${T}/ldap/l1`]: (_m, body) => ({ ...LDAP, ...(body as object) }),
    [`${T}/ldap/l1/test`]: () => {
      throw new ApiError(502, "ldap.dial_failed", "We couldn't reach the directory server.");
    },
    [`${T}/scim`]: () => ({
      token_set: state.scimSet,
      token_prefix: "qf_scim_ab12cd",
      created_at: state.scimSet ? ago(30) : null,
      last_used_at: state.scimSet ? ago(1) : null,
      provisioned_count: state.scimSet ? 3 : 0,
    }),
    [`${T}/scim/users`]: () => ({
      items: state.scimSet
        ? [
            {
              id: "u1",
              email: "asha@qeet.in",
              display_name: "Asha Rao",
              status: "active",
              external_id: "00u1",
              created_at: ago(5),
            },
          ]
        : [],
    }),
    [`${T}/scim/token`]: (m) => {
      if (m === "DELETE") return undefined;
      state.scimSet = true;
      return {
        token: "qf_scim_fresh_token",
        config: {
          token_set: true,
          token_prefix: "qf_scim_fresh",
          created_at: ago(0),
          last_used_at: null,
          provisioned_count: 0,
        },
      };
    },
    [`${T}/saml-providers`]: (m, body) =>
      m === "GET" ? { items: [APP] } : { ...APP, id: "a2", ...(body as object) },
    [`${T}/saml-providers/a1`]: (_m, body) => ({ ...APP, ...(body as object) }),
    [`${T}/admin-portal/links`]: (m) =>
      m === "GET"
        ? {
            items: [
              {
                id: "k1",
                tenant_id: "t1",
                capabilities: ["scim"],
                created_by: "u-me",
                expires_at: new Date(Date.now() + DAY).toISOString(),
                revoked_at: null,
                last_used_at: null,
                created_at: ago(0),
              },
            ],
          }
        : {
            link: {
              id: "k2",
              tenant_id: "t1",
              capabilities: ["saml", "scim"],
              created_by: "u-me",
              expires_at: new Date(Date.now() + DAY).toISOString(),
              revoked_at: null,
              last_used_at: null,
              created_at: ago(0),
            },
            token: "tok",
            url: "https://login.example.com/admin-portal#tok",
          },
    [`${T}/admin-portal/links/k1`]: () => undefined,
    [`${T}/directory/connections`]: () => ({ items: [] }),
    [`${T}/directory/errors`]: () => ({
      ...eventPage([event({})]),
      summary: { open: 1, critical: 1, warning: 0, retried: 0, impacted_users: 0 },
      categories: [],
      connections: [],
      remediations: [],
    }),
    [`${T}/directory/activity`]: (_m, _b, q) => eventPage(q.q === "test" ? [event({})] : []),
    [`${T}/oidc/clients`]: () => ({ items: state.clients }),
    [`${T}/oidc/clients/c1`]: (_m, body) => ({ ...CLIENT, ...(body as object) }),
    [`${T}/oidc/clients/c1/rotate-secret`]: () => ({ client_secret: "new-secret-value" }),
    [`${T}/oidc/clients/c1/auth-failures`]: () => ({ locked_until: null, items: [] }),
    "/v1/oidc/clients": (_m, body) => ({
      client: {
        ...CLIENT,
        id: "c3",
        client_id: "qci_new",
        name: (body as { name: string }).name,
        pkce_exempt_until: null,
      },
      client_secret: "shown-once-secret",
    }),
    "/v1/oidc/clients/c1": () => undefined,
    [`${T}/oauth/grants`]: () => ({
      items: [
        {
          id: "g1",
          client_id: "qci_support",
          user_id: "u1",
          user_email: "",
          scopes: [],
          issued_at: ago(1),
          expires_at: ago(-10),
        },
        {
          id: "g2",
          client_id: "qci_support",
          user_id: "u2",
          user_email: "",
          scopes: [],
          issued_at: ago(1),
          expires_at: ago(-10),
        },
      ],
    }),
  };
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    const method = options?.method ?? "GET";
    const handler = routes[path];
    if (!handler) throw new Error(`unexpected request: ${method} ${path}`);
    return handler(
      method,
      options?.body,
      (options?.query ?? {}) as Record<string, unknown>,
    ) as never;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(api).mockReset();
});

function renderPage(page: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{page}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
const bodyOf = (method: string, path: string) =>
  vi.mocked(api).mock.calls.find(([p, o]) => p === path && o?.method === method)?.[1]?.body;
async function confirmWith(name: string | RegExp) {
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name }));
  return dialog;
}
async function menu(item: string | RegExp, trigger: string | RegExp = "More actions") {
  fireEvent.click(await screen.findByRole("button", { name: trigger }));
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("Authentication › SSO", () => {
  const sso = () => (
    <SsoListPage
      filters={{}}
      onFiltersChange={vi.fn()}
      creating={false}
      onCreatingChange={vi.fn()}
    />
  );

  it("lists the SAML connections and apps in one status word, and points LDAP and SCIM home", async () => {
    renderPage(sso());
    const table = await screen.findByRole("table", { name: "SSO" });
    const row = (name: string) => within(table).getByText(name).closest("tr") as HTMLElement;
    await within(table).findByText("Okta");
    expect(within(row("Okta")).getByText("Connected")).toBeTruthy();
    expect(within(row("Slack")).getByText("SAML app")).toBeTruthy();
    // LDAP and SCIM have one home, Directories › Connections.
    expect(within(table).queryByText("Staging Directory (test)")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Directories › Connections" }).getAttribute("href"),
    ).toBe("/directory/connections");
    expect(screen.queryByText("Kept in sync by SCIM")).toBeNull();
    expect(screen.queryByRole("region", { name: "Not set up yet" })).toBeNull();
    expect(screen.getByRole("link", { name: /Need attention/ }).getAttribute("href")).toBe(
      "/auth/connections/saml?show=attention",
    );
    expect(vi.mocked(api).mock.calls.some(([path]) => String(path).includes("/ldap"))).toBe(false);
  });

  it("offers a kind that isn't set up yet, and opens New SAML connection from the list", async () => {
    state.saml = [];
    const onCreatingChange = vi.fn();
    renderPage(
      <SsoListPage
        filters={{}}
        onFiltersChange={vi.fn()}
        creating={false}
        onCreatingChange={onCreatingChange}
      />,
    );
    const offers = await screen.findByRole("region", { name: "Not set up yet" });
    expect(offers.textContent).toContain("SAML sign-in");
    expect(offers.textContent).not.toContain("SCIM");
    fireEvent.click(within(offers).getByRole("button", { name: /Set up SAML/ }));
    expect(onCreatingChange).toHaveBeenCalledWith(true);
  });

  it("makes a setup link through the sensitive-action path, then shows it once", async () => {
    renderPage(sso());
    fireEvent.click(await screen.findByRole("button", { name: "Create setup link" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create link" }));
    await screen.findByText("https://login.example.com/admin-portal#tok");
    expect(bodyOf("POST", `${T}/admin-portal/links`)).toEqual({
      capabilities: ["saml", "scim"],
      ttl_seconds: 86400,
    });
    expect(sensitive.calls[0]).toMatchObject({ actionLabel: "Create a setup link" });
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("revokes a setup link only once its confirm is accepted", async () => {
    renderPage(sso());
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    const dialog = await confirmWith("Revoke link");
    expect(dialog.textContent).toContain("can't make another change");
    await waitFor(() => expect(writes()).toEqual([`DELETE ${T}/admin-portal/links/k1`]));
  });
});

describe("Directories › SCIM provisioning", () => {
  it("makes the first token without a confirm, and shows it once until Done", async () => {
    renderPage(<ScimPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on provisioning" }));
    expect(await screen.findByText("qf_scim_fresh_token")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitive.calls[0]).toMatchObject({ actionLabel: "Make a SCIM token" });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByText("qf_scim_fresh_token")).toBeNull());
  });

  it("replaces a token only after the confirm, which says the old one stops at once", async () => {
    state.scimSet = true;
    renderPage(<ScimPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Make a new token" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("stops working at once");
    expect(writes()).toEqual([]);
    await confirmWith("Make a new token");
    expect(await screen.findByText("qf_scim_fresh_token")).toBeTruthy();
  });

  it("revokes the token after a confirm that says the people it made stay, and lists them", async () => {
    state.scimSet = true;
    renderPage(<ScimPage />);
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText(/Suspended here, and every session and sign-in ends/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revoke token" }));
    const dialog = await confirmWith("Revoke token");
    expect(dialog.textContent).toContain("The 3 people it created stay");
    await waitFor(() => expect(writes()).toEqual([`DELETE ${T}/scim/token`]));
  });
});

describe("Directories › an LDAP connection", () => {
  it("draws how a sign-in goes through it, with its own values", async () => {
    renderPage(<LdapConnectionPage id="l1" />);
    const how = await screen.findByRole("list", {
      name: "A sign-in through this connection, step by step",
    });
    expect(how.textContent).toContain("cn=svc-qeet-id,ou=service,dc=staging,dc=qeet,dc=in");
    expect(how.textContent).toContain("(uid=%s)");
    expect(how.textContent).toContain("mail → email · cn → name");
  });

  it("leads with its latest failed test and the reason, then tests again and says why it failed", async () => {
    renderPage(<LdapConnectionPage id="l1" />);
    expect(
      await screen.findByText("Qeet ID can't sign in to ldap.staging.qeet.in:636"),
    ).toBeTruthy();
    expect(screen.getAllByText(/no such host/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Test again" }));
    expect(
      (await screen.findAllByText(/Qeet ID couldn't reach the server/)).length,
    ).toBeGreaterThan(0);
    expect(writes()).toEqual([`POST ${T}/ldap/l1/test`]);
  });

  it("deletes it after the confirm says what happens to people, then returns to the list", async () => {
    renderPage(<LdapConnectionPage id="l1" />);
    await menu("Delete connection");
    const dialog = await confirmWith("Delete connection");
    expect(dialog.textContent).toContain("Their accounts, groups and roles stay");
    await waitFor(() => expect(writes()).toEqual([`DELETE ${T}/ldap/l1`]));
    await waitFor(() =>
      expect(nav.navigate).toHaveBeenCalledWith({ to: "/directory/connections", replace: true }),
    );
  });

  it("saves an edit without the password, which stays as saved", async () => {
    renderPage(<LdapConnectionPage id="l1" />);
    await menu("Edit connection");
    const drawer = await screen.findByRole("dialog");
    const baseDn = within(drawer).getByLabelText("Base DN");
    fireEvent.change(baseDn, { target: { value: "ou=staff,dc=qeet,dc=in" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes()).toEqual([`PATCH ${T}/ldap/l1`]));
    const body = bodyOf("PATCH", `${T}/ldap/l1`) as Record<string, unknown>;
    expect(body.base_dn).toBe("ou=staff,dc=qeet,dc=in");
    expect(body).not.toHaveProperty("bind_password");
    expect(sensitive.calls[0]).toMatchObject({ actionLabel: "Change the directory connection" });
  });
});

describe("Directories › LDAP or Active Directory", () => {
  it("opens the one connection's page", async () => {
    renderPage(<LdapIndexPage creating={false} onCreatingChange={vi.fn()} />);
    await waitFor(() =>
      expect(nav.redirects).toContainEqual(
        expect.objectContaining({ to: "/directory/connections/ldap/$id", params: { id: "l1" } }),
      ),
    );
  });

  it("connects a directory as a draft, asking for what the server needs first", async () => {
    state.ldap = [];
    renderPage(<LdapIndexPage creating onCreatingChange={vi.fn()} />);
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(within(drawer).getByRole("button", { name: "Connect" }));
    expect(await within(drawer).findByText("Enter a name.")).toBeTruthy();
    expect(writes()).toEqual([]);
    const type = (label: string, value: string) =>
      fireEvent.change(within(drawer).getByLabelText(label), { target: { value } });
    type("Name", "Corp AD");
    type("Server URL", "ldaps://ad.corp.example.com:636");
    type("Service account (bind DN)", "cn=svc,dc=corp");
    type("Service account password", "s3cret");
    type("Base DN", "ou=people,dc=corp");
    fireEvent.click(within(drawer).getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(writes()).toEqual([`POST ${T}/ldap`]));
    expect(bodyOf("POST", `${T}/ldap`)).toMatchObject({
      name: "Corp AD",
      server_url: "ldaps://ad.corp.example.com:636",
      bind_password: "s3cret",
      user_filter: "(uid=%s)",
      start_tls: false,
      status: "draft",
    });
    await waitFor(() =>
      expect(nav.navigate).toHaveBeenCalledWith({
        to: "/directory/connections/ldap/$id",
        params: { id: "l2" },
      }),
    );
  });
});

describe("SSO › a SAML connection", () => {
  it("reads its certificate, and gives the provider Qeet ID's own details", async () => {
    renderPage(<SamlConnectionPage id="s1" />);
    expect(await screen.findByText(/Okta IdP · valid until/)).toBeTruthy();
    expect(screen.getByText("https://id.example.com/saml/acs/s1")).toBeTruthy();
    expect(screen.getByText("https://id.example.com/saml/metadata/s1")).toBeTruthy();
  });

  it("warns before its certificate ends", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2036-10-15T00:00:00Z"));
    renderPage(<SamlConnectionPage id="s1" />);
    expect(await screen.findByText(/signing certificate ends in \d+ days/)).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
  });

  it("runs the server's checks and says each result in words", async () => {
    renderPage(<SamlConnectionPage id="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Run the checks" }));
    await waitFor(() => expect(screen.getAllByText("Passed")).toHaveLength(5));
    expect(writes()).toEqual([`POST ${T}/saml/s1/test`]);
  });

  it("turns off and accepts provider-started sign-ins only after their confirms", async () => {
    renderPage(<SamlConnectionPage id="s1" />);
    await menu("Turn off");
    await confirmWith("Turn off");
    await waitFor(() => expect(bodyOf("PATCH", `${T}/saml/s1`)).toEqual({ status: "disabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    const dialog = await confirmWith("Accept");
    expect(dialog.textContent).toContain("refuses a response used twice");
    await waitFor(() =>
      expect(
        vi
          .mocked(api)
          .mock.calls.filter(([p, o]) => p === `${T}/saml/s1` && o?.method === "PATCH")
          .at(-1)?.[1]?.body,
      ).toEqual({ allow_idp_initiated: true }),
    );
  });

  it("deletes it after a confirm that says the accounts stay", async () => {
    renderPage(<SamlConnectionPage id="s1" />);
    await menu("Delete connection");
    const dialog = await confirmWith("Delete connection");
    expect(dialog.textContent).toContain("Their accounts, groups and roles stay");
    await waitFor(() => expect(writes()).toEqual([`DELETE ${T}/saml/s1`]));
  });

  it("starts a new connection from the provider's metadata, as a draft", async () => {
    state.saml = [];
    renderPage(
      <SsoListPage filters={{}} onFiltersChange={vi.fn()} creating onCreatingChange={vi.fn()} />,
    );
    const drawer = await screen.findByRole("dialog");
    const xml = `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="http://www.okta.com/exk9"><IDPSSODescriptor><KeyDescriptor use="signing"><KeyInfo><X509Data><X509Certificate>${OKTA_CERT.replace(/-----[^-]+-----/g, "")}</X509Certificate></X509Data></KeyInfo></KeyDescriptor><SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://acme.okta.com/sso/saml"/></IDPSSODescriptor></EntityDescriptor>`;
    fireEvent.change(within(drawer).getByLabelText(/Or paste the metadata/), {
      target: { value: xml },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Read metadata" }));
    expect((within(drawer).getByLabelText("Sign-in URL") as HTMLInputElement).value).toBe(
      "https://acme.okta.com/sso/saml",
    );
    fireEvent.change(within(drawer).getByLabelText("Name"), { target: { value: "Okta (staff)" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Create connection" }));
    await waitFor(() => expect(writes()).toEqual([`POST ${T}/saml`]));
    expect(bodyOf("POST", `${T}/saml`)).toMatchObject({
      name: "Okta (staff)",
      idp_entity_id: "http://www.okta.com/exk9",
      status: "draft",
    });
  });
});

describe("SSO › SAML apps", () => {
  it("gives Qeet ID's details, and removes an app only after its confirm", async () => {
    renderPage(<SamlAppsPage adding={false} onAddingChange={vi.fn()} />);
    expect(await screen.findByText("https://id.example.com/saml/idp/t1/metadata")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Test sign-in/ }).getAttribute("href")).toBe(
      "https://id.example.com/saml/idp/t1/sso?sp=a1",
    );
    await menu("Remove app", "More actions for Slack");
    const dialog = await confirmWith("Remove app");
    expect(dialog.textContent).toContain("Their accounts here stay");
    await waitFor(() => expect(writes()).toEqual([`DELETE ${T}/saml-providers/a1`]));
  });

  it("adds an app, refusing an address the server won't post to", async () => {
    renderPage(<SamlAppsPage adding onAddingChange={vi.fn()} />);
    const drawer = await screen.findByRole("dialog");
    fireEvent.change(within(drawer).getByLabelText("Name"), { target: { value: "AWS" } });
    fireEvent.change(within(drawer).getByLabelText("Entity ID"), {
      target: { value: "https://aws/sp" },
    });
    fireEvent.change(within(drawer).getByLabelText("ACS URL"), {
      target: { value: "http://aws.example.com/acs" },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add app" }));
    expect(await within(drawer).findByText(/Enter an https:\/\/ address/)).toBeTruthy();
    fireEvent.change(within(drawer).getByLabelText("ACS URL"), {
      target: { value: "https://aws.example.com/acs" },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add app" }));
    await waitFor(() => expect(writes()).toEqual([`POST ${T}/saml-providers`]));
  });
});

describe("Applications", () => {
  it("says what kind each app is, its one status and who is signed in to it", async () => {
    renderPage(
      <OidcAppsPage
        filters={{}}
        onFiltersChange={vi.fn()}
        registering={false}
        onRegisteringChange={vi.fn()}
      />,
    );
    const table = await screen.findByRole("table", { name: "Applications" });
    const row = (await within(table).findByText("Support Desk")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Web app")).toBeTruthy();
    expect(within(row).getByText(/PKCE off until/)).toBeTruthy();
    await waitFor(() => expect(within(row).getByText("2")).toBeTruthy());
    const cli = within(table).getByText("Qeet CLI").closest("tr") as HTMLElement;
    expect(within(cli).getByText("Command line")).toBeTruthy();
  });

  it("registers a confidential app, shows its secret once, and opens it on Done", async () => {
    renderPage(
      <OidcAppsPage
        filters={{}}
        onFiltersChange={vi.fn()}
        registering
        onRegisteringChange={vi.fn()}
      />,
    );
    const drawer = await screen.findByRole("dialog");
    fireEvent.change(within(drawer).getByLabelText("Name"), { target: { value: "Billing" } });
    fireEvent.change(within(drawer).getByLabelText("Redirect URIs"), {
      target: { value: "https://billing.qeet.in/callback" },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Register application" }));
    expect(await screen.findByText(/shown-once-secret/)).toBeTruthy();
    expect(bodyOf("POST", "/v1/oidc/clients")).toMatchObject({
      tenant_id: "t1",
      name: "Billing",
      type: "confidential",
      redirect_uris: ["https://billing.qeet.in/callback"],
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Done" })[0] as HTMLElement);
    expect(nav.navigate).toHaveBeenCalledWith({
      to: "/auth/connections/oidc/$clientId",
      params: { clientId: "qci_new" },
    });
  });

  it("deletes an app from its row only after the confirm", async () => {
    renderPage(
      <OidcAppsPage
        filters={{}}
        onFiltersChange={vi.fn()}
        registering={false}
        onRegisteringChange={vi.fn()}
      />,
    );
    const table = await screen.findByRole("table", { name: "Applications" });
    const row = (await within(table).findByText("Support Desk")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /actions/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await confirmWith("Delete application");
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/oidc/clients/c1"]));
  });
});

describe("An application", () => {
  const page = () => <OidcAppPage clientId="qci_support" tab="overview" onTabChange={vi.fn()} />;

  it("leads with its proof-key exemption, then its credentials", async () => {
    renderPage(page());
    expect(await screen.findByText(/PKCE is off for this app until/)).toBeTruthy();
    expect(screen.getByText("qci_support")).toBeTruthy();
    expect(screen.getByText("Browser sign-in, Refresh")).toBeTruthy();
    expect(await screen.findByText("None recently")).toBeTruthy();
  });

  it("rotates the secret only after the confirm, then shows the new one once", async () => {
    renderPage(page());
    await menu("Rotate secret");
    const dialog = await confirmWith("Rotate secret");
    expect(dialog.textContent).toContain("stops working at once");
    expect(await screen.findByText(/new-secret-value/)).toBeTruthy();
    expect(writes()).toEqual([`POST ${T}/oidc/clients/c1/rotate-secret`]);
  });

  it("asks an app holding client_credentials to drop it before saving", async () => {
    state.clients = [{ ...CLIENT, grant_types: ["authorization_code", "client_credentials"] }];
    renderPage(page());
    await menu("Edit");
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    expect(await within(drawer).findByText(/Drop client_credentials/)).toBeTruthy();
    expect(writes()).toEqual([]);
  });

  it("deletes it after the confirm, then returns to the list", async () => {
    renderPage(page());
    await menu("Delete application");
    await confirmWith("Delete application");
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/oidc/clients/c1"]));
    await waitFor(() =>
      expect(nav.navigate).toHaveBeenCalledWith({ to: "/auth/connections/oidc" }),
    );
  });
});
