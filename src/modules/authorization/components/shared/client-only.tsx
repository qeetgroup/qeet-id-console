import { type ReactNode, useEffect, useState } from "react";

/**
 * Renders `fallback` until mounted in the browser, then `children`. React Flow and Monaco touch
 * `window` and `document`, which neither the server render nor the first hydration pass has.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
