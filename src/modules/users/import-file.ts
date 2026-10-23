// Reads a bulk-import file. A small CSV parser (header row, RFC 4180 quote escapes, no quoted line
// breaks) covers the bulk endpoint's few fields; NDJSON is one object per line.

import type { ImportRowError } from "./import-errors";

/** One user parsed from the file, with the line it came from. */
export interface ImportRow {
  email: string;
  password?: string;
  display_name?: string;
  phone?: string;
  line: number;
  error?: ImportRowError; // found while parsing; the row isn't sent
}

const MISSING_EMAIL = { code: "user.import_field_missing", field: "email" };

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function lines(text: string): { text: string; line: number }[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((t, i) => ({ text: t, line: i + 1 }))
    .filter((l) => l.text.trim() !== "");
}

function parseCSV(text: string): ImportRow[] {
  const [header, ...data] = lines(text);
  if (!header) return [];
  const columns = parseCSVLine(header.text).map((h) => h.toLowerCase());
  return data.map(({ text: line, line: number }) => {
    const cols = parseCSVLine(line);
    const get = (key: string) => {
      const i = columns.indexOf(key);
      return i >= 0 ? (cols[i] ?? "") : "";
    };
    const row: ImportRow = {
      email: get("email"),
      password: get("password") || undefined,
      display_name: get("display_name") || undefined,
      phone: get("phone") || undefined,
      line: number,
    };
    if (!row.email) row.error = { ...MISSING_EMAIL, line: number };
    return row;
  });
}

function parseNDJSON(text: string): ImportRow[] {
  return lines(text).map(({ text: line, line: number }) => {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const row: ImportRow = {
        email: typeof obj.email === "string" ? obj.email.trim() : "",
        password: typeof obj.password === "string" ? obj.password : undefined,
        display_name: typeof obj.display_name === "string" ? obj.display_name : undefined,
        phone: typeof obj.phone === "string" ? obj.phone : undefined,
        line: number,
      };
      if (!row.email) row.error = { ...MISSING_EMAIL, line: number };
      return row;
    } catch {
      return {
        email: "",
        line: number,
        error: { code: "user.import_row_malformed", line: number },
      };
    }
  });
}

/** Returns the users in an import file, NDJSON by its extension and CSV otherwise. */
export function parseImportFile(fileName: string, text: string): ImportRow[] {
  const name = fileName.toLowerCase();
  return name.endsWith(".ndjson") || name.endsWith(".jsonl") ? parseNDJSON(text) : parseCSV(text);
}

/** The most users the bulk endpoint takes in one request. */
export const MAX_IMPORT_ROWS = 1000;
