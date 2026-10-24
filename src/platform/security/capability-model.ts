import i18n from "@/i18n";

export const CONSOLE_CAPABILITIES = [
  "tenant.read",
  "tenant.write",
  "user.read",
  "user.write",
  "role.read",
  "role.write",
  "group.read",
  "group.write",
  "policy.read",
  "policy.write",
  "apikey.read",
  "apikey.write",
  "connection.read",
  "connection.write",
  "webhook.read",
  "webhook.write",
  "secret.read",
  "secret.write",
  "branding.write",
  "gdpr.write",
  "audit.read",
  "audit.write",
  "billing.read",
  "billing.write",
  "analytics.read",
] as const;

export type Capability = (typeof CONSOLE_CAPABILITIES)[number];
export type CapabilitySet = ReadonlySet<string>;
export type AccessResolution = "resolving" | "ready" | "error";
export type AccessMode = "setup" | "full" | "read-only" | "restricted" | "none" | "unknown";

export function createCapabilitySet(items: readonly string[] | undefined): CapabilitySet {
  return new Set((items ?? []).filter(Boolean));
}

export function hasCapability(
  permissions: CapabilitySet,
  permission: Capability | undefined,
): boolean {
  return permission === undefined || permissions.has(permission);
}

export function hasAllCapabilities(
  permissions: CapabilitySet,
  required: readonly Capability[],
): boolean {
  return required.every((permission) => permissions.has(permission));
}

export function hasAnyCapability(
  permissions: CapabilitySet,
  required: readonly Capability[],
): boolean {
  return required.some((permission) => permissions.has(permission));
}

export function classifyAccessMode(permissions: CapabilitySet, hasWorkspace: boolean): AccessMode {
  if (!hasWorkspace) return "setup";
  if (permissions.size === 0) return "none";
  if (CONSOLE_CAPABILITIES.every((permission) => permissions.has(permission))) return "full";

  const values = Array.from(permissions);
  const hasRead = values.some((permission) => permission.endsWith(".read"));
  const hasWrite = values.some((permission) => permission.endsWith(".write"));

  if (hasRead && !hasWrite) return "read-only";
  return "restricted";
}

/** Returns a capability's name as an operator reads it, such as "View users". */
export function capabilityLabel(permission: Capability): string {
  return i18n.t(`common:capability.${permission}`);
}
