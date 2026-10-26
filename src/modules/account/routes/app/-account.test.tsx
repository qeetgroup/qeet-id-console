// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const route = vi.hoisted(() => ({ pathname: "/account/data" }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: object) => ({ options }),
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <p>The chosen page</p>,
  useLocation: () => ({ pathname: route.pathname }),
}));

import { Route } from "./account";

const options = Route.options as unknown as {
  component: () => React.JSX.Element;
  beforeLoad: (ctx: { location: { pathname: string } }) => void;
  staticData: { pageHeader?: boolean };
};

afterEach(cleanup);

describe("My account", () => {
  it("lists its four pages in a column, the chosen one marked and beside them", () => {
    render(<options.component />);

    expect(screen.getByRole("heading", { level: 1, name: "My account" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "My account" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/account/profile",
      "/account/security",
      "/account/sessions",
      "/account/data",
    ]);
    const current = within(nav).getByRole("link", { name: /Data & Privacy/ });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(links.filter((link) => link.getAttribute("aria-current"))).toHaveLength(1);
    expect(screen.getByText("The chosen page")).toBeTruthy();
  });

  it("opens on Profile, and draws its own header in the console", () => {
    expect(() => options.beforeLoad({ location: { pathname: "/account" } })).toThrow();
    expect(() => options.beforeLoad({ location: { pathname: "/account/" } })).toThrow();
    expect(() => options.beforeLoad({ location: { pathname: "/account/security" } })).not.toThrow();
    expect(options.staticData.pageHeader).toBe(true);
  });
});
