// Lives beside the route with a "-" prefix so the router generator ignores it.
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route } from "./$userId_.timeline";

const beforeLoad = Route.options.beforeLoad as unknown as (ctx: {
  params: { userId: string };
  search: Record<string, string>;
}) => void;

describe("a person's old timeline address", () => {
  it("lands on their page's Activity view, with its period and filters", () => {
    let landed: unknown;
    try {
      beforeLoad({ params: { userId: "u-1" }, search: { period: "90d", result: "failed" } });
    } catch (thrown) {
      if (isRedirect(thrown)) landed = thrown.options;
      else throw thrown;
    }
    expect(landed).toMatchObject({
      to: "/users/$userId",
      params: { userId: "u-1" },
      search: { tab: "activity", period: "90d", result: "failed" },
    });
  });
});
