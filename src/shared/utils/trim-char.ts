// Trimming a repeated character in one pass: a regex such as /\/+$/ retries from every position
// of a long run, so its time grows with the square of the run.

/** `value` without `char` repeated at its end. */
export function trimEndChar(value: string, char: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === char) end--;
  return value.slice(0, end);
}

/** `value` without `char` repeated at either end. */
export function trimChar(value: string, char: string): string {
  let start = 0;
  while (start < value.length && value[start] === char) start++;
  return trimEndChar(value.slice(start), char);
}
