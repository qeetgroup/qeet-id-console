// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@/i18n";

import type { OidcClient } from "../api/oidc-clients";
import { ApplicationStats } from "../components/application-stats";

function client(overrides: Partial<OidcClient> = {}): OidcClient {
  return {
    id: "row-1",
    tenant_id: "tenant-1",
    client_id: "qci_1",
    name: "App one",
    type: "public",
    redirect_uris: ["https://app.acme.com/callback"],
    post_logout_uris: [],
    grant_types: ["authorization_code", "refresh_token"],
    scopes: ["openid", "profile"],
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** The card's numeric value sits alongside its label in the same wrapper. */
function cardValue(label: string): string {
  const el = screen.getByText(label).parentElement?.querySelector("p:nth-of-type(2)");
  return el?.textContent ?? "";
}

afterEach(cleanup);

describe("ApplicationStats", () => {
  it("counts total, public and confidential clients", () => {
    render(
      <ApplicationStats
        clients={[
          client({ id: "a", client_id: "qci_a", type: "public" }),
          client({ id: "b", client_id: "qci_b", type: "public" }),
          client({ id: "c", client_id: "qci_c", type: "confidential" }),
        ]}
      />,
    );

    expect(cardValue("Total applications")).toBe("3");
    expect(cardValue("Public clients")).toBe("2");
    expect(cardValue("Confidential clients")).toBe("1");
  });

  it("captions the newest client by created_at, not list order", () => {
    render(
      <ApplicationStats
        clients={[
          client({
            id: "a",
            client_id: "qci_a",
            name: "Older",
            created_at: "2026-01-01T00:00:00Z",
          }),
          client({
            id: "b",
            client_id: "qci_b",
            name: "Newer",
            created_at: "2026-06-01T00:00:00Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Newer")).toBeTruthy();
    expect(screen.queryByText("Older")).toBeNull();
  });

  it("shows an em dash rather than a date when there are no applications", () => {
    render(<ApplicationStats clients={[]} />);

    expect(screen.getByText("No applications yet")).toBeTruthy();
    expect(cardValue("Recently registered")).toBe("—");
    expect(cardValue("Total applications")).toBe("0");
  });

  it("renders skeletons while loading", () => {
    const { container } = render(<ApplicationStats clients={[]} isLoading />);

    expect(screen.queryByText("Total applications")).toBeNull();
    expect(container.querySelectorAll(".h-24")).toHaveLength(4);
  });
});
