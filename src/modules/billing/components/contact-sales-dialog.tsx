// The Enterprise contact-sales drawer, as the billing barrel exports it. The drawer itself loads on
// first open (contact-sales-drawer.tsx), so every page that imports the barrel for useEntitlements
// or FeatureGate doesn't carry it. The caller owns the open state.
import { lazy, Suspense, useState } from "react";

const ContactSalesDrawer = lazy(() => import("./contact-sales-drawer"));

export function ContactSalesDialog({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: string; // where the form opened, recorded on the lead, e.g. "onboarding"
}) {
  // Stays mounted once opened, so the drawer can play its closing transition.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? (
    <Suspense fallback={null}>
      <ContactSalesDrawer open={open} onOpenChange={onOpenChange} source={source} />
    </Suspense>
  ) : null;
}
