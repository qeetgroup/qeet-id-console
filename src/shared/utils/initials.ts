// Derive up-to-two-letter initials from a name or email. Domain-independent —
// the single source for avatar/monogram fallbacks across the console.
// "Mareedu Saibabu" → "MS"; "qeetgroup@gmail.com" → "QG"; robust to single words.
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
