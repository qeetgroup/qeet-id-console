// An application's logo and home page (logo_uri, client_uri): the rule the server holds them to,
// and what the hosted sign-in page shows of them.
import { z } from "zod";

import i18n, { type TranslationKey } from "@/i18n";

/** The longest logo or home page address the server stores. */
export const PRESENTATION_URI_MAX_LENGTH = 2048;

export type PresentationUriProblem =
  | "tooLong"
  | "malformed"
  | "notHttps"
  | "credentials"
  | "fragment";

// The message for each reason an address is refused.
const PRESENTATION_URI_MESSAGES: Record<PresentationUriProblem, TranslationKey> = {
  tooLong: "oidc:presentation.validation.tooLong",
  malformed: "oidc:presentation.validation.malformed",
  notHttps: "oidc:presentation.validation.notHttps",
  credentials: "oidc:presentation.validation.credentials",
  fragment: "oidc:presentation.validation.fragment",
};

/**
 * Returns why `value` can't be an application's logo or home page, or null when it can: blank
 * (none, or clearing one) or, trimmed, an absolute https URL with a host, of at most 2048
 * characters, without credentials or a fragment. That is the server's rule, so the server never
 * refuses an address this accepts.
 */
export function presentationUriProblem(value: string): PresentationUriProblem | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > PRESENTATION_URI_MAX_LENGTH) return "tooLong";
  const url = parse(raw);
  if (!url) return "malformed";
  if (url.protocol !== "https:") return "notHttps";
  if (url.username || url.password) return "credentials";
  if (raw.includes("#")) return "fragment";
  return null;
}

/** A form field holding a logo or home page address; its message says what is wrong with it. */
export const presentationUriField = z.string().superRefine((value, ctx) => {
  const problem = presentationUriProblem(value);
  if (problem) {
    ctx.addIssue({ code: "custom", message: i18n.t(PRESENTATION_URI_MESSAGES[problem]) });
  }
});

// The browser's parser is laxer than the server's: it drops tabs and newlines, reads backslashes
// as slashes, and finds a host in `https:host` or `https:///host`. So the address must spell out
// `scheme://host` and hold no whitespace or backslash.
function parse(raw: string): URL | null {
  if (/[\s\\\p{Cc}]/u.test(raw) || !/^[a-z][a-z\d+.-]*:\/\/[^/]/i.test(raw)) return null;
  if (!URL.canParse(raw)) return null;
  const url = new URL(raw);
  return url.hostname ? url : null;
}

function presentationUrl(value = ""): URL | undefined {
  if (!value.trim() || presentationUriProblem(value)) return undefined;
  return parse(value.trim()) ?? undefined;
}

/** The logo the hosted sign-in page shows: the address when it is https, else none. */
export function applicationLogo(logoUri?: string): string | undefined {
  return presentationUrl(logoUri)?.href;
}

/** The home page as the hosted sign-in page shows it, by its host, and the address it links to. */
export function applicationHomePage(
  clientUri?: string,
): { host: string; href: string } | undefined {
  const url = presentationUrl(clientUri);
  return url && { host: url.host, href: url.href };
}
