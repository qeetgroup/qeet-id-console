import { useSyncExternalStore } from "react";

const PHONE = "(max-width: 640px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the page is phone-width, so a table can keep only the columns that say what each row
 * is (until the library Table has column priority for narrow screens, findings §5). False on the
 * server.
 */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}
