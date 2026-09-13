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
      ? `<img src="${escapeEmailHTML(brand.logo)}" alt="" width="48" style="height:auto;max-height:64px;object-fit:contain">`
      : "";
  const preheader = previewEmailDraft({ subject: "", body: content.preheader ?? "" }, samples).body;
  return `<!doctype html><html lang="${escapeEmailHTML(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{margin:0;font-family:Arial,sans-serif;color:#18181b;background:#fff;font-size:12px}p{line-height:1.65}a{color:${primary};pointer-events:none}img{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f4f5;padding:12px}blockquote{border-left:3px solid ${primary};margin:12px 0;padding-left:12px}h1,h2,h3{line-height:1.4}ul,ol{padding-left:22px}</style></head><body><div style="display:none;max-height:0;overflow:hidden">${escapeEmailHTML(preheader)}</div><header style="padding:18px 12px;background:${primary}0d;border-top:3px solid ${primary};text-align:${draft.options.alignment === "left" ? "left" : "center"}">${logo}<div style="font-size:14px;font-weight:700;margin-top:6px">${name}</div></header><main style="padding:20px 14px;overflow-wrap:anywhere"><h1 style="font-size:17px;margin:0 0 18px">${escapeEmailHTML(preview.subject)}</h1>${markup}</main><footer style="padding:14px;text-align:center;border-top:1px solid #f4f4f5;font-size:10px;color:#71717a">${name}</footer></body></html>`;
}
