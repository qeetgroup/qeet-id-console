// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children?: ReactNode }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
}));

import { AuthenticationActivityPanel } from "../components/dashboard-charts";

afterEach(cleanup);

const row = {
  day: "Oct 22",
  password: 5,
  passkey: 4,
  social: 3,
  saml: 2,
  oidc: 1,
  magic_link: 7,
  ldap: 6,
};

describe("AuthenticationActivityPanel", () => {
  it("counts every sign-in method the server reports, magic link and LDAP included", () => {
    render(<AuthenticationActivityPanel rows={[row]} loading={false} take={7} />);

    const table = screen.getByRole("table");
    const headers = [...table.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(headers).toEqual(expect.arrayContaining(["Magic link", "LDAP"]));
    const cells = [...table.querySelectorAll("tbody td")].map((td) => td.textContent);
    expect(cells).toEqual(["5", "4", "3", "2", "1", "7", "6"]);
  });
});
