import { DashboardOverview } from "./dashboard-overview";

/**
 * Renders the dashboard. Someone without an organisation never reaches it: the console sends
 * them to choose one, join one they're invited to, or create their first.
 */
export function DashboardPage() {
  return <DashboardOverview />;
}
