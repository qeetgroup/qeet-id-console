// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createInstance } from "i18next";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { StatusPill } from "../status-pill";

afterEach(cleanup);

// A second language, so a translated word can't be mistaken for the kit's own English.
const french = createInstance();
beforeAll(async () => {
  await french.init({
    lng: "fr",
    defaultNS: "common",
    resources: { fr: { common: { status: { active: "Actif", authorized: "Autorisé" } } } },
  });
});

function renderInFrench(ui: ReactElement) {
  return render(<I18nextProvider i18n={french}>{ui}</I18nextProvider>);
}

// The pill's text; its dot is an empty span.
function label(container: HTMLElement): string | null | undefined {
  return container.querySelector('[data-slot="status-pill"]')?.textContent;
}

describe("StatusPill", () => {
  it("names a known status in the console's language, not the kit's English", () => {
    const { container } = renderInFrench(<StatusPill status="ACTIVE" />);

    expect(label(container)).toBe("Actif");
  });

  it("names a status the kit doesn't know from the catalogue", () => {
    const { container } = renderInFrench(<StatusPill status="authorized" />);

    expect(label(container)).toBe("Autorisé");
  });

  it("names a status from the English catalogue", () => {
    const { container } = render(<StatusPill status="revoked" />);

    expect(label(container)).toBe("Revoked");
  });

  it("renders a caller's own label instead of the status word", () => {
    const { container } = renderInFrench(<StatusPill status="active">Principal</StatusPill>);

    expect(label(container)).toBe("Principal");
  });

  it("keeps the kit's own label for a status with no key", () => {
    const known = renderInFrench(<StatusPill status="locked" />);
    const unknown = renderInFrench(<StatusPill status="past_due" />);

    expect(label(known.container)).toBe("Locked");
    expect(label(unknown.container)).toBe("Past due");
  });

  it("keeps the kit's colour for the status", () => {
    const { container } = render(<StatusPill status="revoked" />);

    expect(container.querySelector('[data-slot="status-pill"]')?.getAttribute("data-kind")).toBe(
      "danger",
    );
  });
});
