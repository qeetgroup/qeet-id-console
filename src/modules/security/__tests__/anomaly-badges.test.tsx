// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@/i18n";

import { AnomalySeverityBadge, AnomalyStatusBadge } from "../components/anomaly-badges";

afterEach(cleanup);

const badge = (text: string) => screen.getByText(text).closest('[data-slot="badge"]');

// The library's Badge says its tone and variant in data attributes.
function look(text: string) {
  const el = badge(text);
  return `${el?.getAttribute("data-tone")} ${el?.getAttribute("data-variant")}`;
}

describe("An anomaly's severity and status", () => {
  it("gives critical the strongest style, above high", () => {
    render(
      <>
        <AnomalySeverityBadge severity="critical" />
        <AnomalySeverityBadge severity="high" />
      </>,
    );
    expect(look("Critical")).toBe("danger solid");
    expect(look("High")).toBe("danger subtle");
  });

  it("names each severity in words, a new one the quietest", () => {
    render(
      <>
        <AnomalySeverityBadge severity="medium" />
        <AnomalySeverityBadge severity="low" />
        <AnomalySeverityBadge severity="very_high" />
      </>,
    );
    expect(look("Medium")).toBe("warning subtle");
    expect(look("Low")).toBe("neutral subtle");
    expect(look("Very High")).toBe("neutral subtle");
  });

  it("shows an anomaly open until it is resolved, whatever its status says", () => {
    render(
      <>
        <AnomalyStatusBadge anomaly={{ status: "rate-limited", resolved_at: null }} />
        <AnomalyStatusBadge anomaly={{ status: "open" }} />
        <AnomalyStatusBadge anomaly={{ status: "resolved", resolved_at: "2026-10-24T09:00:00Z" }} />
        <AnomalyStatusBadge
          anomaly={{ status: "rate-limited", resolved_at: "2026-10-24T09:00:00Z" }}
        />
      </>,
    );
    expect(screen.getAllByText("Open")).toHaveLength(2);
    expect(screen.getAllByText("Resolved")).toHaveLength(2);
    expect(screen.queryByText(/rate/i)).toBeNull();
  });
});
