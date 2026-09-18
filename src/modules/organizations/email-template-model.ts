import DOMPurify from "dompurify";
import {
  type EmailTemplate,
  type EmailTemplateInput,
  type EmailTemplateTranslation,
  sampleVar,
} from "./api/email-templates";

export type EmailTemplateDraft = Pick<EmailTemplate, "subject" | "body">;

export function previewEmailDraft(
  draft: EmailTemplateDraft,
  variables: Record<string, string>,
): EmailTemplateDraft {
  const render = (value: string) =>
    value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
      Object.hasOwn(variables, key) ? variables[key] : match,
    );
  return { subject: render(draft.subject), body: render(draft.body) };
}

export function unknownEmailVariables(draft: EmailTemplateDraft, supported: string[]): string[] {
  const names = [
    ...`${draft.subject}\n${draft.body}`.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g),
  ].map((match) => match[1]);
  return [...new Set(names.filter((name) => !supported.includes(name)))];
}

export const EMAIL_LOCALES = ["en", "de", "es", "fr", "hi", "ja", "pt", "zh"] as const;
export type EmailBrand = { name: string; logo?: string; primary?: string };

export function emailTemplateInput(template: EmailTemplate): EmailTemplateInput {
  return {
    subject: template.subject,
    body: template.body,
    options: {
      preheader: "",
      body_html: "",
      default_locale: "en",
      translations: {},
      show_logo: true,
      alignment: "center",
      ...template.options,
    },
  };
}

export function emailLocaleContent(
  draft: EmailTemplateInput,
  locale: string,
): EmailTemplateTranslation {
  return locale === "en"
    ? {
        subject: draft.subject,
        body: draft.body,
        preheader: draft.options.preheader ?? "",
        body_html: draft.options.body_html ?? "",
      }
    : (draft.options.translations?.[locale] ?? {
        subject: "",
        body: "",
        preheader: "",
        body_html: "",
      });
}

export function updateEmailLocale(
  draft: EmailTemplateInput,
  locale: string,
  patch: Partial<EmailTemplateTranslation>,
): EmailTemplateInput {
  const content = { ...emailLocaleContent(draft, locale), ...patch };
  return locale === "en"
    ? {
        ...draft,
        subject: content.subject,
        body: content.body,
        options: { ...draft.options, preheader: content.preheader, body_html: content.body_html },
      }
    : {
        ...draft,
        options: {
          ...draft.options,
          translations: { ...draft.options.translations, [locale]: content },
        },
      };
}

export function emailDraftErrors(draft: EmailTemplateInput, supported: string[]): string[] {
  const errors: string[] = [];
  const contents = [
    emailLocaleContent(draft, "en"),
    ...Object.values(draft.options.translations ?? {}),
  ];
  if (contents.some((content) => !content.subject.trim() || !content.body.trim()))
    errors.push("required");
  if (
    contents.some(
      (content) =>
        content.subject.length > 200 ||
        (content.preheader?.length ?? 0) > 200 ||
        content.body.length > 150000 ||
        (content.body_html?.length ?? 0) > 200000,
    )
  )
    errors.push("length");
  if (contents.some((content) => /[\r\n]/.test(content.subject + (content.preheader ?? ""))))
    errors.push("header");
  if (
    contents.some(
      (content) =>
        unknownEmailVariables(
          {
            subject: content.subject,
            body: content.body + (content.preheader ?? "") + (content.body_html ?? ""),
          },
          supported,
        ).length > 0,
    )
  )
    errors.push("variables");
  if (
    contents.some((content) =>
      supported
        .filter((name) => name.endsWith("_url"))
        .some((name) => {
          const includes = (value: string) =>
            [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].some(
              (match) => match[1] === name,
            );
          return !includes(content.body) || (!!content.body_html && !includes(content.body_html));
        }),
    )
  )
    errors.push("actionLink");
  return errors;
}

export function emailTextHTML(value: string): string {
  return value
    .split(/\n\n/)
    .map((paragraph) => `<p>${escapeEmailHTML(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function escapeEmailHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeEmailHTML(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "img",
      "hr",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "width", "height", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

export function emailHTMLText(value: string): string {
  const document = new DOMParser().parseFromString(sanitizeEmailHTML(value), "text/html");
  for (const link of document.querySelectorAll("a[href]")) {
    const destination = link.getAttribute("href");
    if (destination && !link.textContent?.includes(destination))
      link.append(document.createTextNode(` (${destination})`));
  }
  for (const line of document.querySelectorAll("br"))
    line.replaceWith(document.createTextNode("\n"));
  for (const block of document.querySelectorAll("p,h1,h2,h3,li,blockquote,pre"))
    block.append(document.createTextNode("\n\n"));
  return document.body.textContent?.trim() ?? "";
}

export function validEmailTemplateLink(value: string, variables: string[]): boolean {
  const variable = value.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/)?.[1];
  return !!variable && variable.endsWith("_url") && variables.includes(variable);
}

export function validEmailAssetURL(value: string): boolean {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Subject and preheader with variables filled in, as the inbox row shows them.
 *
 * Shares `previewEmailDraft` with the document so the header line can never
 * drift from the rendered email — the two are the same substitution.
 */
/**
 * Every link the rendered email contains, with variables resolved.
 *
 * The preview iframe is `sandbox=""` and sets `pointer-events:none`, so links
 * are deliberately inert there — it renders tenant-authored markup, and a live
 * anchor would let a template navigate the operator's session. Listing the
 * resolved destinations gives the thing clicking was for (checking where a link
 * goes) without granting navigation, and shows every link at once rather than
 * one at a time.
 */
export function emailPreviewLinks(
  draft: EmailTemplateInput,
  locale: string,
  variables: string[],
  brand: EmailBrand,
): { text: string; href: string }[] {
  const content = emailLocaleContent(draft, locale);
  const samples = Object.fromEntries(
    variables.map((name) => [name, name === "tenant_name" ? brand.name : sampleVar(name)]),
  );
  const source = content.body_html
    ? sanitizeEmailHTML(previewEmailDraft({ subject: "", body: content.body_html }, samples).body)
    : emailTextHTML(previewEmailDraft(content, samples).body);
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const seen = new Set<string>();
  const out: { text: string; href: string }[] = [];
  for (const link of parsed.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href")?.trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push({ text: link.textContent?.trim() || href, href });
  }
  return out;
}

export function emailPreviewHeader(
  draft: EmailTemplateInput,
  locale: string,
  variables: string[],
  brand: EmailBrand,
): { subject: string; preheader: string } {
  const content = emailLocaleContent(draft, locale);
  const samples = Object.fromEntries(
    variables.map((name) => [name, name === "tenant_name" ? brand.name : sampleVar(name)]),
  );
  return {
    subject: previewEmailDraft(content, samples).subject,
    preheader: previewEmailDraft({ subject: "", body: content.preheader ?? "" }, samples).body,
  };
}

export function emailPreviewDocument(
  draft: EmailTemplateInput,
  locale: string,
  variables: string[],
  brand: EmailBrand,
): string {
  const content = emailLocaleContent(draft, locale);
  const samples = Object.fromEntries(
    variables.map((name) => [name, name === "tenant_name" ? brand.name : sampleVar(name)]),
  );
  const preview = previewEmailDraft(content, samples);
  const escapedSamples = Object.fromEntries(
    Object.entries(samples).map(([key, value]) => [key, escapeEmailHTML(value)]),
  );
  const markup = content.body_html
    ? sanitizeEmailHTML(
        previewEmailDraft({ subject: "", body: content.body_html }, escapedSamples).body,
      )
    : emailTextHTML(preview.body);
  const primary = /^#[\da-f]{6}$/i.test(brand.primary ?? "") ? brand.primary : "#f97316";
  const name = escapeEmailHTML(brand.name || "Qeet ID");
  const logo =
    draft.options.show_logo !== false && brand.logo && validEmailAssetURL(brand.logo)
      ? `<img src="${escapeEmailHTML(brand.logo)}" alt="" width="120" style="height:auto;max-height:40px;object-fit:contain;display:block${draft.options.alignment === "left" ? "" : ";margin:0 auto"}">`
      : `<div style="font-size:17px;font-weight:700;letter-spacing:-0.01em;color:#18181b">${name}</div>`;
  const preheader = previewEmailDraft({ subject: "", body: content.preheader ?? "" }, samples).body;
  const align = draft.options.alignment === "left" ? "left" : "center";

  // Rendered as a real transactional email rather than a bare document: a
  // 600px card centred on a neutral page, the width every mail client and
  // template framework converges on. Inline styles and table-free flow are kept
  // simple because this is a preview, not the sent artefact.
  //
  // The CSP, sanitizeEmailHTML() and escapeEmailHTML() calls above are load
  // bearing — the iframe renders tenant-authored markup, so links are inert
  // (pointer-events:none) and scripts/handlers are stripped before they arrive.
  return `<!doctype html><html lang="${escapeEmailHTML(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>
:root{color-scheme:light}
body{margin:0;padding:24px 16px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#27272a;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.shell{max-width:600px;margin:0 auto}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgb(0 0 0 / 4%),0 8px 24px rgb(0 0 0 / 4%)}
.accent{height:4px;background:${primary}}
.head{padding:28px 32px 0;text-align:${align}}
.body{padding:24px 32px 32px;overflow-wrap:anywhere}
h1{font-size:22px;line-height:1.3;margin:0 0 16px;color:#18181b;letter-spacing:-0.01em;font-weight:650}
h2{font-size:18px;line-height:1.35;margin:24px 0 10px;color:#18181b}
h3{font-size:16px;line-height:1.4;margin:20px 0 8px;color:#18181b}
p{margin:0 0 14px}
p:last-child{margin-bottom:0}
a{color:${primary};pointer-events:none;text-decoration:underline;text-underline-offset:2px}
strong{color:#18181b}
img{max-width:100%;height:auto;border-radius:6px}
ul,ol{padding-left:20px;margin:0 0 14px}
li{margin:0 0 6px}
pre,code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:14px;margin:0 0 14px;letter-spacing:0.04em}
blockquote{border-left:3px solid ${primary};margin:0 0 14px;padding:2px 0 2px 14px;color:#52525b}
hr{border:0;border-top:1px solid #e4e4e7;margin:24px 0}
/* A lone link on its own line reads as the call to action. */
.body p > a:only-child{display:inline-block;pointer-events:none;background:${primary};color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:15px;margin:4px 0}
.foot{padding:18px 32px 24px;text-align:center;color:#a1a1aa;font-size:12px;line-height:1.5}
.foot .org{color:#71717a;font-weight:600}
.legal{margin-top:6px}
</style></head><body><div class="shell"><div class="card"><div class="accent"></div><div style="display:none;max-height:0;overflow:hidden">${escapeEmailHTML(preheader)}</div><div class="head">${logo}</div><div class="body"><h1>${escapeEmailHTML(preview.subject)}</h1>${markup}</div></div><div class="foot"><div class="org">${name}</div><div class="legal">This is an automated message — please don't reply.</div></div></div></body></html>`;
}
