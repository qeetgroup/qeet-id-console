import i18n from "@/i18n";

export const AUTH_METHOD_KEYS = ["password", "passkey", "social", "saml", "oidc"] as const;

export type DashboardRange = "7d" | "14d";

export function takeLatest<T>(items: T[], count: number): T[] {
  return items.length > count ? items.slice(-count) : items;
}

export function formatDelta(value: number, unit: "%" | "pp" = "%"): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}${unit}`;
}

export function authMethodColor(method: string): string {
  const key = method.toLowerCase().replace(/[^a-z]/g, "");
  const index = (AUTH_METHOD_KEYS as readonly string[]).indexOf(key);
  return index >= 0 ? `var(--chart-${index + 1})` : "var(--chart-1)";
}

// Protocol names read the same in every language; the other codes are catalogue keys.
const PROTOCOL_METHODS: Record<string, string> = { saml: "SAML", oidc: "OIDC", ldap: "LDAP" };
const LOGIN_METHOD_KEYS: Record<string, string> = {
  password: "dashboard:dashboardCharts.methods.password",
  passkey: "dashboard:dashboardCharts.methods.passkey",
  social: "dashboard:dashboardCharts.methods.social",
  magic_link: "dashboard:dashboardCharts.methods.magicLink",
};

/** Returns the display name of a sign-in method code from the analytics overview. */
export function loginMethodLabel(method: string): string {
  const code = method.toLowerCase();
  const key = LOGIN_METHOD_KEYS[code];
  if (key) return i18n.t(key);
  // An unknown code reads as words rather than as a raw identifier.
  const words = PROTOCOL_METHODS[code] ?? method.replace(/[._]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type MfaMethodId = "totp" | "passkey" | "sms" | "email" | "recovery";

/** Maps the analytics overview's MFA method name ("Recovery Codes") onto a stable id. */
export function mfaMethodId(method: string): MfaMethodId | undefined {
  const key = method.toLowerCase();
  if (key.startsWith("totp")) return "totp";
  if (key.startsWith("passkey")) return "passkey";
  if (key.startsWith("sms")) return "sms";
  if (key.startsWith("email")) return "email";
  if (key.startsWith("recovery")) return "recovery";
  return undefined;
}

const MFA_COLORS: Record<MfaMethodId, string> = {
  totp: "var(--chart-1)",
  passkey: "var(--chart-2)",
  sms: "var(--chart-3)",
  email: "var(--chart-4)",
  recovery: "var(--chart-5)",
};

export function mfaMethodColor(method: string): string {
  const id = mfaMethodId(method);
  return id ? MFA_COLORS[id] : "var(--chart-1)";
}

/** Returns the display name of an MFA method, or the name the backend sent for an unknown one. */
export function mfaMethodLabel(method: string): string {
  const id = mfaMethodId(method);
  if (id === "totp" || id === "sms") return id.toUpperCase();
  return id ? i18n.t(`dashboard:dashboardCharts.mfaMethods.${id}`) : method;
}

export function formatAuditAction(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
