/**
 * Returns up to two initials for a name or email, e.g. "Mareedu Saibabu" → "MS" and
 * "a@qeet.in" → "AQ".
 */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);
  const [first, second] = parts;
  if (first === undefined) return "?";
  if (second === undefined) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}
