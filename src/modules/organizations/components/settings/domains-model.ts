// Settings › Domains: names checked as the server checks them, and its words for a failed check.
import type { DNSRecord, LoginDomainStatus } from "@/modules/organizations/api/domains";

/**
 * A domain as the server keeps it (domainverify.normalizeDomain, validDomain): lower case, without
 * a scheme, path, port or final dot; 3 to 253 characters of letters, digits, dots and hyphens, with
 * at least one dot. null when the server would refuse it.
 */
export function checkDomain(raw: string): string | null {
  let domain = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  const cut = domain.search(/[/:]/);
  if (cut >= 0) domain = domain.slice(0, cut);
  domain = domain.replace(/\.$/, "");
  if (domain.length < 3 || domain.length > 253 || !domain.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(domain)) return null;
  if (domain.split(".").some((label) => !label || label.startsWith("-") || label.endsWith("-")))
    return null;
  return domain;
}

/** Why the last check failed, from the server's stored reason (English, so never shown as is). */
export function checkFailure(lastError?: string): "notFound" | "lookup" | "other" {
  if (lastError === "DNS TXT record not found") return "notFound";
  if (lastError === "DNS lookup failed") return "lookup";
  return "other";
}

/** How far the sign-in address has got: 0 records, 1 certificate, 2 going live, 3 live. */
export function loginStep(status?: LoginDomainStatus): number {
  if (!status?.dns_verified) return 0;
  if (status.tls_state !== "issued") return 1;
  return status.endpoint_state === "live" ? 3 : 2;
}

/**
 * The records to publish, each named in full. The server names the TXT record relative to the
 * address ("_qeetid-verify") but looks it up at "_qeetid-verify.<address>", so that's the name.
 */
export function loginRecords(status: LoginDomainStatus): DNSRecord[] {
  const host = status.login_domain;
  return status.records.map((record) =>
    !host || record.name === host || record.name.endsWith(`.${host}`)
      ? record
      : { ...record, name: `${record.name}.${host}` },
  );
}
