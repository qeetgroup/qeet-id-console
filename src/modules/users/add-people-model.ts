// Add people: what happens to each address typed into an invitation, before anything is sent.
// Pure, so the drawer and its tests share it.
import type { Invitation } from "./api/invitations";
import type { User } from "./api/users";

/** The most invitations one send goes out with, so a pasted list can't fan out without bound. */
export const MAX_INVITES = 50;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Each address once, as typed: one per line, or separated by commas, semicolons or spaces. */
export function parseAddresses(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const email = raw.trim().replace(/^<|>$/g, "");
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    out.push(email);
  }
  return out;
}

export type AddressCheck =
  | { email: string; kind: "new" }
  | { email: string; kind: "invited"; invite: Invitation }
  | { email: string; kind: "member"; user: User }
  | { email: string; kind: "invalid" };

/** What sending to each address does: a new invitation, the pending one again, or nothing. */
export function checkAddresses(
  emails: readonly string[],
  members: readonly User[],
  invites: readonly Invitation[],
): AddressCheck[] {
  const byEmail = new Map(members.map((u) => [u.email.toLowerCase(), u]));
  const pending = new Map(
    invites.filter((i) => i.status === "pending").map((i) => [i.email.toLowerCase(), i]),
  );
  return emails.map((email): AddressCheck => {
    const key = email.toLowerCase();
    if (!EMAIL.test(key)) return { email, kind: "invalid" };
    const user = byEmail.get(key);
    if (user) return { email, kind: "member", user };
    const invite = pending.get(key);
    if (invite) return { email, kind: "invited", invite };
    return { email, kind: "new" };
  });
}

/** The addresses a send goes to: new ones and pending ones (sent again). */
export const sendable = (checks: readonly AddressCheck[]) =>
  checks.filter((c) => c.kind === "new" || c.kind === "invited");

export const isEmail = (value: string) => EMAIL.test(value.trim());

/** "+91 98765 43210" as E.164, or null when it isn't a phone number with its country code. */
export function toE164(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(digits) ? digits : null;
}
