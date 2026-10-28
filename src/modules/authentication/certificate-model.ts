// An identity provider's signing certificate, read in the browser: who it names, when it ends,
// and its SHA-256 fingerprint, so a page can say "valid until 22 Aug 2030" and warn before it
// lapses. The server stores the certificate as pasted (PEM or bare base64 DER) and checks it only
// on save and in a connection's test; it reports neither its end nor its fingerprint.

export type CertificateFacts = {
  /** The subject's common name, else its organisation: "Google". */
  subject: string;
  notBefore: Date;
  notAfter: Date;
  der: Uint8Array;
};

/** The DER bytes of a PEM block or bare base64, or null when it isn't either. */
export function certificateDer(raw: string): Uint8Array | null {
  const body = raw
    .replace(/-----(BEGIN|END)[^-]*-----/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return null;
  try {
    return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

type Node = { tag: number; start: number; end: number; next: number };

// One DER element at `at`: its tag, where its contents start and end, and where the next begins.
function read(bytes: Uint8Array, at: number): Node | null {
  if (at + 2 > bytes.length) return null;
  const tag = bytes[at] ?? 0;
  let length = bytes[at + 1] ?? 0;
  let start = at + 2;
  if (length & 0x80) {
    const size = length & 0x7f;
    if (size < 1 || size > 4 || start + size > bytes.length) return null;
    length = 0;
    for (let i = 0; i < size; i++) length = length * 256 + (bytes[start + i] ?? 0);
    start += size;
  }
  const end = start + length;
  return end > bytes.length ? null : { tag, start, end, next: end };
}

function children(bytes: Uint8Array, node: Node): Node[] {
  const out: Node[] = [];
  for (let at = node.start; at < node.end; ) {
    const child = read(bytes, at);
    if (!child) return [];
    out.push(child);
    at = child.next;
  }
  return out;
}

const text = (bytes: Uint8Array, node: Node) =>
  new TextDecoder().decode(bytes.subarray(node.start, node.end));

// UTCTime (YYMMDDhhmmssZ) or GeneralizedTime (YYYYMMDDhhmmssZ).
function time(bytes: Uint8Array, node: Node): Date | null {
  const value = text(bytes, node);
  const m =
    node.tag === 0x17
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(value)
      : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(value);
  if (!m) return null;
  let year = Number(m[1]);
  if (node.tag === 0x17) year += year < 50 ? 2000 : 1900;
  const date = new Date(
    Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

// The Name's attribute with this OID (2.5.4.3 common name, 2.5.4.10 organisation).
function nameAttribute(bytes: Uint8Array, name: Node, oid: readonly number[]): string | null {
  for (const set of children(bytes, name)) {
    for (const pair of children(bytes, set)) {
      const [id, value] = children(bytes, pair);
      if (!id || !value || id.tag !== 0x06) continue;
      const got = bytes.subarray(id.start, id.end);
      if (got.length === oid.length && oid.every((b, i) => got[i] === b)) return text(bytes, value);
    }
  }
  return null;
}

const COMMON_NAME = [0x55, 0x04, 0x03] as const;
const ORGANISATION = [0x55, 0x04, 0x0a] as const;

/** Reads a certificate's subject and validity, or null when it can't be read. */
export function readCertificate(raw: string): CertificateFacts | null {
  const der = certificateDer(raw);
  if (!der) return null;
  const cert = read(der, 0);
  const tbs = cert?.tag === 0x30 ? children(der, cert)[0] : undefined;
  if (tbs?.tag !== 0x30) return null;
  const parts = children(der, tbs);
  // An explicit version ([0]) comes first in v3 certificates.
  const offset = parts[0]?.tag === 0xa0 ? 1 : 0;
  const validity = parts[offset + 3];
  const subject = parts[offset + 4];
  if (!validity || !subject) return null;
  const [from, to] = children(der, validity);
  const notBefore = from && time(der, from);
  const notAfter = to && time(der, to);
  if (!notBefore || !notAfter) return null;
  return {
    subject:
      nameAttribute(der, subject, COMMON_NAME) ?? nameAttribute(der, subject, ORGANISATION) ?? "",
    notBefore,
    notAfter,
    der,
  };
}

/** The certificate's SHA-256 fingerprint as people compare it: "99:31:4F:…:84:45". */
export async function fingerprint(der: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", der as BufferSource));
  return [...digest].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

/** A long fingerprint kept readable: its first four pairs and its last two. */
export const shortFingerprint = (full: string) => {
  const pairs = full.split(":");
  return pairs.length > 8 ? `${pairs.slice(0, 4).join(":")}…${pairs.slice(-2).join(":")}` : full;
};
