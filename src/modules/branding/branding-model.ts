export type Branding = {
  tenant_id: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  custom_domain?: string | null;
  email_from_name?: string | null;
  email_from_address?: string | null;
  settings?: Record<string, unknown> | null;
};

export const BRANDING_COLORS = { primary: "#f97316", secondary: "#8b5cf6" } as const;

export type BrandingDraft = {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  custom_domain: string;
  email_from_name: string;
  email_from_address: string;
  email_reply_to: string;
};

export type BrandingErrors = Partial<
  Record<keyof BrandingDraft, "color" | "logo" | "domain" | "email" | "header">
>;

export function brandingDraft(branding: Branding): BrandingDraft {
  return {
    logo_url: branding.logo_url ?? "",
    primary_color: branding.primary_color || BRANDING_COLORS.primary,
    secondary_color: branding.secondary_color || BRANDING_COLORS.secondary,
    background_color:
      typeof branding.settings?.background_color === "string"
        ? branding.settings.background_color
        : "",
    custom_domain: branding.custom_domain ?? "",
    email_from_name: branding.email_from_name ?? "",
    email_from_address: branding.email_from_address ?? "",
    email_reply_to:
      typeof branding.settings?.email_reply_to === "string" ? branding.settings.email_reply_to : "",
  };
}

export function normalizeBrandColor(value: string): string | null {
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color))
    return `#${[...color.slice(1)]
      .map((digit) => digit.repeat(2))
      .join("")
      .toLowerCase()}`;
  return null;
}

export function validBrandLogo(value: string): boolean {
  const source = value.trim();
  if (!source) return true;
  if (source.startsWith("data:"))
    return (
      /^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-z0-9+/]+={0,2}$/i.test(source) &&
      source.length <= Math.ceil((2 * 1024 * 1024 * 4) / 3) + 64
    );
  try {
    const url = new URL(source);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validBrandDomain(value: string): boolean {
  const domain = value.trim();
  if (!domain) return true;
  if (domain.length > 253 || /[\s/:?#@]/.test(domain)) return false;
  const labels = domain.split(".");
  return (
    labels.length > 1 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
}

export function validateBranding(draft: BrandingDraft): BrandingErrors {
  const errors: BrandingErrors = {};
  if (!normalizeBrandColor(draft.primary_color)) errors.primary_color = "color";
  if (!normalizeBrandColor(draft.secondary_color)) errors.secondary_color = "color";
  if (draft.background_color && !normalizeBrandColor(draft.background_color))
    errors.background_color = "color";
  if (!validBrandLogo(draft.logo_url)) errors.logo_url = "logo";
  if (!validBrandDomain(draft.custom_domain)) errors.custom_domain = "domain";
  if (
    draft.email_from_address.trim() &&
    !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(draft.email_from_address.trim())
  )
    errors.email_from_address = "email";
  if (
    draft.email_reply_to.trim() &&
    !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(draft.email_reply_to.trim())
  )
    errors.email_reply_to = "email";
  if (/[\r\n]/.test(draft.email_from_name)) errors.email_from_name = "header";
  return errors;
}

export function brandingInput(draft: BrandingDraft, current: Branding): Branding {
  const { background_color, email_reply_to, ...fields } = draft;
  const settings = { ...current.settings };
  if (background_color || "background_color" in settings)
    settings.background_color = normalizeBrandColor(background_color) ?? "";
  if (email_reply_to || "email_reply_to" in settings)
    settings.email_reply_to = email_reply_to.trim();
  return {
    tenant_id: current.tenant_id,
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim()])),
    primary_color: normalizeBrandColor(draft.primary_color) ?? current.primary_color,
    secondary_color: normalizeBrandColor(draft.secondary_color) ?? current.secondary_color,
    custom_domain: draft.custom_domain.trim().toLowerCase(),
    settings,
  };
}

function colorLuminance(color: string): number {
  const hex = normalizeBrandColor(color) ?? "#ffffff";
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function brandingContrast(first: string, second: string): number {
  const firstLight = colorLuminance(first);
  const secondLight = colorLuminance(second);
  return (Math.max(firstLight, secondLight) + 0.05) / (Math.min(firstLight, secondLight) + 0.05);
}

export function brandingForeground(background: string): "#0a0a0a" | "#000000" | "#ffffff" {
  const dark = brandingContrast(background, "#0a0a0a");
  const light = brandingContrast(background, "#ffffff");
  if (Math.max(dark, light) < 4.5) return "#000000";
  return dark > light ? "#0a0a0a" : "#ffffff";
}
