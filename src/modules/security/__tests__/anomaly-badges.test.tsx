// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@/i18n";

import { AnomalySeverityBadge, AnomalyStatusBadge } from "../components/anomaly-badges";

afterEach(cleanup);

const badge = (text: string) => screen.getByText(text).closest('[data-slot="badge"]');

// The kit's Badge marks its variant only in its classes.
function variant(text: string) {
  const classes = badge(text)?.className ?? "";
  if (classes.includes("bg-destructive-subtle")) return "destructive";
  if (classes.includes("bg-secondary")) return "secondary";
  if (classes.includes("border-border")) return "outline";
  return classes;
}

describe("An anomaly's severity and status", () => {
  it("gives critical the strongest style, above high", () => {
    render(
      <>
        <AnomalySeverityBadge severity="critical" />
        <AnomalySeverityBadge severity="high" />
      </>,
    );
    expect(variant("Critical")).toBe("destructive");
    expect(variant("High")).toBe("destructive");
    expect(badge("Critical")?.className).toContain("ring-2");
    expect(badge("High")?.className).not.toContain("ring-2");
  });

  it("names each severity in words, a new one the quietest", () => {
    render(
      <>
        <AnomalySeverityBadge severity="medium" />
        <AnomalySeverityBadge severity="low" />
        <AnomalySeverityBadge severity="very_high" />
      </>,
    );
    expect(variant("Medium")).toBe("secondary");
    expect(variant("Low")).toBe("outline");
    expect(variant("Very High")).toBe("outline");
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
