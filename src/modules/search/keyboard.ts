export type NavigationDirection = "up" | "down";

/** Clamps an index to [0, totalItems - 1], or 0 for an empty list. */
export function clampHighlight(index: number, totalItems: number): number {
  if (totalItems === 0) return 0;
  return Math.min(totalItems - 1, Math.max(0, index));
}

/** Moves the highlight one step, stopping at either end rather than wrapping. */
export function moveHighlight(
  current: number,
  direction: NavigationDirection,
  totalItems: number,
): number {
  if (direction === "down") return clampHighlight(current + 1, totalItems);
  return clampHighlight(current - 1, totalItems);
}
