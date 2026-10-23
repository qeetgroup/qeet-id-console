// The before → after field changes a timeline event's payload carries.

import i18n from "@/i18n";

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

/** Turns a payload field name such as `mfa_required` into a title-cased label. */
export function humanizeField(field: string): string {
  return field.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Formats a changed value for display: a blank as a dash, a boolean as Enabled or Disabled. */
export function formatChangeValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") {
    return i18n.t(
      value ? "timeline:timelineDetailsDrawer.enabled" : "timeline:timelineDetailsDrawer.disabled",
    );
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Returns before → after changes from `metadata.changes` entries ({ from, to } or [old, new])
 * and from the fields that differ between `metadata.before` and `metadata.after`.
 */
export function extractChanges(metadata: Record<string, unknown> | undefined): FieldChange[] {
  if (!metadata) return [];
  const out: FieldChange[] = [];

  const changes = metadata.changes;
  if (changes && typeof changes === "object" && !Array.isArray(changes)) {
    for (const [field, raw] of Object.entries(changes)) {
      if (Array.isArray(raw) && raw.length >= 2) {
        out.push({ field, before: raw[0], after: raw[1] });
      } else if (raw && typeof raw === "object") {
        const v = raw as Record<string, unknown>;
        const before = v.from ?? v.old ?? v.before ?? v.previous;
        const after = v.to ?? v.new ?? v.after ?? v.current;
        if (before !== undefined || after !== undefined) out.push({ field, before, after });
      }
    }
  }

  const before = metadata.before;
  const after = metadata.after;
  if (before && after && typeof before === "object" && typeof after === "object") {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    for (const field of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (JSON.stringify(b[field]) !== JSON.stringify(a[field]))
        out.push({ field, before: b[field], after: a[field] });
    }
  }

  return out;
}
