/** `bytes` random bytes as hex, from the platform's cryptographic source (also on plain http). */
export function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
}
