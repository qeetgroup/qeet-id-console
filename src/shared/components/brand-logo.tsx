/** The third-party logos the console shows, each a file in `public/brand/`. */
export type BrandLogoName =
  | "anthropic"
  | "apple"
  | "discord"
  | "facebook"
  | "github"
  | "gitlab"
  | "google"
  | "linkedin"
  | "microsoft"
  | "microsoft-azure"
  | "openai"
  | "slack"
  | "twitch"
  | "x";

/**
 * A provider's own logo, in its own colours, as an image from this console (`public/brand/`): no
 * JavaScript, and cached by the browser once seen. Decorative: the words beside it name the
 * provider. A single-colour mark drawn for one scheme is inverted in the other: `invert="light"`
 * for a white mark (Apple), `"dark"` for a black one (GitHub), styled where it sits.
 */
export function BrandLogo({
  name,
  invert,
  size = 20,
  className,
}: {
  name: BrandLogoName;
  invert?: "light" | "dark";
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={`/brand/${name}.svg`}
      alt=""
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      data-invert={invert}
      className={className}
    />
  );
}
