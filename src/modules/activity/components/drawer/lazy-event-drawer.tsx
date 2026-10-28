import { lazy, Suspense, useRef } from "react";

import type { ActivityEventDrawerProps } from "./event-drawer";

// The drawer and its styles load with the first event a page opens, not with the page (or the
// shell, which carries this module's barrel).
const EventDrawer = /* @__PURE__ */ lazy(() =>
  import("./event-drawer").then((m) => ({ default: m.ActivityEventDrawer })),
);

/**
 * The event drawer for other modules (Security › Audit logs): the same drawer the Activity page
 * opens, loaded the first time an event opens. Pass any audit event's ID.
 */
export function ActivityEventDrawer(props: ActivityEventDrawerProps) {
  const opened = useRef(false);
  if (props.eventId) opened.current = true;
  if (!opened.current) return null;
  return (
    <Suspense fallback={null}>
      <EventDrawer {...props} />
    </Suspense>
  );
}
