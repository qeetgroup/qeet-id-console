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

/** The values Branding changes, each saved on its own. */
export type BrandingChange = {
  logo_url?: string | null;
  primary_color?: string | null;
  background_color?: string | null;
  email_from_name?: string;
  email_from_address?: string;
  email_reply_to?: string;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** The page background, from settings, when it's a colour the sign-in page would use. */
export function brandingBackground(branding: Branding): string | null {
  return normalizeBrandColor(text(branding.settings?.background_color));
}

export function brandingReplyTo(branding: Branding): string {
  return text(branding.settings?.email_reply_to);
}

/**
 * The whole record with one change applied. The server's PUT replaces every field, so everything
 * this change doesn't touch goes back as stored: the accent colour (which the sign-in page never
 * reads, so the page doesn't offer it), the sign-in address (changed in Settings › Domains) and
 * every other setting.
 */
export function brandingWith(current: Branding, change: BrandingChange): Branding {
  const settings: Record<string, unknown> = { ...(current.settings ?? {}) };
  if ("background_color" in change) {
    settings.background_color = normalizeBrandColor(change.background_color ?? "") ?? "";
  }
  if ("email_reply_to" in change) settings.email_reply_to = (change.email_reply_to ?? "").trim();
  const kept = <Key extends keyof Branding>(key: Key) => current[key] ?? null;
  return {
    tenant_id: current.tenant_id,
    logo_url: "logo_url" in change ? change.logo_url?.trim() || null : kept("logo_url"),
    primary_color:
      "primary_color" in change
        ? normalizeBrandColor(change.primary_color ?? "")
        : kept("primary_color"),
    secondary_color: kept("secondary_color"),
    custom_domain: kept("custom_domain"),
    email_from_name:
      "email_from_name" in change
        ? change.email_from_name?.trim() || null
        : kept("email_from_name"),
    email_from_address:
      "email_from_address" in change
        ? change.email_from_address?.trim() || null
        : kept("email_from_address"),
    settings,
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

/** A logo the sign-in page can show: an http(s) URL without credentials, or an image file up to 2 MB. */
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

/** What a logo is, for its row: the image type of a file, or the host it loads from. */
export function brandLogoSource(
  value: string,
): { kind: "file"; type: "svg" | "png" | "jpeg" | "webp" } | { kind: "url"; host: string } | null {
  const file = /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.exec(value.trim());
  if (file?.[1]) {
    const type = file[1].toLowerCase();
    return { kind: "file", type: type === "svg+xml" ? "svg" : (type as "png" | "jpeg" | "webp") };
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? { kind: "url", host: url.host }
      : null;
  } catch {
    return null;
  }
}

/** One address, as the server accepts for the reply-to and sender. */
export function validBrandEmail(value: string): boolean {
  const address = value.trim();
  return !address || /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(address);
}

function colorLuminance(color: string): number {
  const hex = normalizeBrandColor(color) ?? "#ffffff";
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
}

export function brandingContrast(first: string, second: string): number {
  const firstLight = colorLuminance(first);
  const secondLight = colorLuminance(second);
  return (Math.max(firstLight, secondLight) + 0.05) / (Math.min(firstLight, secondLight) + 0.05);
}

/**
 * The label colour the sign-in page draws on a brand colour (qeet-id-hosted's
 * readableForeground): near-black or white, whichever reads better, or black when neither
 * reaches 4.5:1.
 */
export function brandingForeground(background: string): "#0a0a0a" | "#000000" | "#ffffff" {
  const dark = brandingContrast(background, "#0a0a0a");
  const light = brandingContrast(background, "#ffffff");
  if (Math.max(dark, light) < 4.5) return "#000000";
  return dark > light ? "#0a0a0a" : "#ffffff";
}
