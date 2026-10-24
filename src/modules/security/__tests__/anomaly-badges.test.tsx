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

  it("names a status in words, not the server's value", () => {
    render(
      <>
        <AnomalyStatusBadge status="open" />
        <AnomalyStatusBadge status="resolved" />
        <AnomalyStatusBadge status="under_review" />
      </>,
    );
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Resolved")).toBeTruthy();
    expect(screen.getByText("Under Review")).toBeTruthy();
  });
});
