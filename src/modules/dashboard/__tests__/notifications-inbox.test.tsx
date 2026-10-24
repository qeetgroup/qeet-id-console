// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/modules/developer", () => ({
  useNotifications: () => ({
    data: {
      unread_count: 2,
      items: [
        {
          id: "n-1",
          kind: "warning",
          title: "Approve a sign-in on another device",
          created_at: "2026-10-24T10:00:00Z",
          href: "",
        },
        {
          id: "n-2",
          kind: "alert",
          title: "Credential stuffing detected",
          created_at: "2026-10-24T09:00:00Z",
          href: "/security/threats/anomalies",
        },
      ],
    },
  }),
  useMarkAllRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { NotificationsInbox } from "../components/notifications-inbox";

afterEach(() => {
  cleanup();
  navigate.mockReset();
});

describe("The notification bell", () => {
  it("opens a notification's link, and shows one without a link as plain text", () => {
    render(<NotificationsInbox />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    // A CIBA request has no link: nothing to press.
    expect(screen.queryByRole("button", { name: /Approve a sign-in/ })).toBeNull();
    expect(screen.getByText("Approve a sign-in on another device")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Credential stuffing detected/ }));
    expect(navigate).toHaveBeenCalledWith({ to: "/security/threats/anomalies" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
