// Templates and import, as pure functions the drawers and their tests share: a template's outline
// and what applying it would make, and a CSV of groups read and checked row by row before anything
// is sent. Names are unique in an organisation, ignoring case and surrounding space (the server's
// rule), and a template is applied all at once or not at all.
import type { Group, GroupTemplateNode, ImportRow } from "./api/groups";

/** The server's limits on a template: how deep it nests, and how many groups it makes. */
export const TEMPLATE_MAX_DEPTH = 6;
export const TEMPLATE_MAX_GROUPS = 200;

const key = (name: string) => name.trim().toLowerCase();

// ── Templates ───────────────────────────────────────────────────────────────────────────────

/**
 * Parses an outline (one group per line, two spaces per level) into a template's groups. A line
 * indented too deep attaches at the deepest open level, so a stray space loses nothing.
 */
export function parseOutline(text: string): GroupTemplateNode[] {
  const roots: GroupTemplateNode[] = [];
  const stack: GroupTemplateNode[] = []; // stack[d] is the group open at depth d
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    const depth = Math.min(Math.floor(indent / 2), stack.length);
    const node: GroupTemplateNode = { name: raw.trim(), children: [] };
    const parent = depth ? stack[depth - 1] : undefined;
    if (parent) {
      parent.children = parent.children ?? [];
      parent.children.push(node);
    } else roots.push(node);
    stack.length = depth;
    stack.push(node);
  }
  return roots;
}

/** Every group a template makes, each before the ones inside it. */
export function templateGroups(nodes: readonly GroupTemplateNode[]): GroupTemplateNode[] {
  return nodes.flatMap((n) => [n, ...templateGroups(n.children ?? [])]);
}

/** How many levels a template nests. */
export function templateDepth(nodes: readonly GroupTemplateNode[]): number {
  return nodes.reduce((d, n) => Math.max(d, 1 + templateDepth(n.children ?? [])), 0);
}

/** What's wrong with an outline before it's saved, or null: too deep, or too many groups. */
export function outlineProblem(
  nodes: readonly GroupTemplateNode[],
): "depth" | "size" | "empty" | null {
  if (!nodes.length) return "empty";
  if (templateDepth(nodes) > TEMPLATE_MAX_DEPTH) return "depth";
  if (templateGroups(nodes).length > TEMPLATE_MAX_GROUPS) return "size";
  return null;
}

/** The groups a template makes whose names are already taken, each with the group that has it. */
export function templateClashes(
  nodes: readonly GroupTemplateNode[],
  groups: readonly Group[],
): { name: string; taken: Group }[] {
  const byName = new Map(groups.map((g) => [key(g.name), g]));
  return templateGroups(nodes).flatMap((n) => {
    const taken = byName.get(key(n.name));
    return taken ? [{ name: n.name, taken }] : [];
  });
}

// ── Import ──────────────────────────────────────────────────────────────────────────────────

/** Reads CSV text: commas, quoted fields ("a, b"), doubled quotes ("say ""hi""") and any line end. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

/** A row of the file, with its line number in the file (the header is line 1). */
export type ImportLine = ImportRow & { line: number };

/**
 * The file's groups. Columns are name, parent, description, in that order, or in any order under a
 * header row that names them ("name", "parent", "description"; "group" and "inside" work too).
 */
export function importLines(text: string): ImportLine[] {
  const rows = parseCsv(text);
  const head = rows[0]?.map(key) ?? [];
  const named = head.some((h) => h === "name" || h === "group");
  const at = (names: string[], fallback: number) => {
    const i = head.findIndex((h) => names.includes(h));
    return named ? i : fallback;
  };
  const col = {
    name: at(["name", "group"], 0),
    parent: at(["parent", "inside", "parent group"], 1),
    description: at(["description"], 2),
  };
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  return rows.slice(named ? 1 : 0).map((r, i) => {
    const parent = cell(r, col.parent);
    const description = cell(r, col.description);
    return {
      line: i + (named ? 2 : 1),
      name: cell(r, col.name),
      ...(parent ? { parent } : {}),
      ...(description ? { description } : {}),
    };
  });
}

export type ImportOutcome = "new" | "exists" | "repeated" | "parent" | "unnamed";

/**
 * What the server will do with each row, worked out before anything is sent: new, already exists
 * (skipped), a name an earlier row already uses, a parent that's neither a group nor a row, or no
 * name. A parent may be a group, or another row of the file, before or after it.
 */
export function checkImport(
  lines: readonly ImportLine[],
  groups: readonly Group[],
): (ImportLine & { outcome: ImportOutcome })[] {
  const existing = new Set(groups.map((g) => key(g.name)));
  const inFile = new Set(lines.map((l) => key(l.name)).filter(Boolean));
  const seen = new Set<string>();
  return lines.map((l) => {
    const name = key(l.name);
    let outcome: ImportOutcome = "new";
    if (!name) outcome = "unnamed";
    else if (existing.has(name)) outcome = "exists";
    else if (seen.has(name)) outcome = "repeated";
    else if (l.parent && !existing.has(key(l.parent)) && !inFile.has(key(l.parent)))
      outcome = "parent";
    if (name) seen.add(name);
    return { ...l, outcome };
  });
}

/** A sample file's rows: a group at the top, and two inside it. */
export const SAMPLE_ROWS = [
  { name: "Data", parent: "", description: "Everyone who works with data" },
  { name: "Data Engineering", parent: "Data", description: "Pipelines and the warehouse" },
  { name: "Analytics", parent: "Data", description: "Reports and dashboards" },
];
