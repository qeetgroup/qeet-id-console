// The initials an Avatar shows, by the library's rule (first letter of the first and last words),
// so a control that shows them can be named starting with them (WCAG 2.5.3, label in name). The
// library doesn't export its helper; initials.test.tsx holds the two to the same answer.

const graphemes =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;

function firstLetter(word: string): string {
  if (!graphemes) return Array.from(word)[0] ?? "";
  const [first] = graphemes.segment(word);
  return first?.segment ?? "";
}

/** "Priya Sharma" is "PS"; "Priya" is "P". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const last = words.length > 1 ? (words.at(-1) ?? "") : "";
  return (firstLetter(first) + firstLetter(last)).toLocaleUpperCase();
}
