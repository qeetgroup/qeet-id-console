import { QeetLogo } from "@qeetrix/icons";
import { cn } from "@qeetrix/ui";

type QeetMarkProps = {
  /** Rendered height in px. The mark is square, so this is also its width. */
  height: number;
  className?: string;
  /** Names the mark. Without it the mark is decorative. */
  "aria-label"?: string;
};

/**
 * The Qeet mark, following the console theme: the light-surface file in light
 * mode, the dark-surface file in dark mode.
 *
 * `@qeetrix/icons` logos are images and cannot see the theme, so both files
 * render and the `dark:` variant shows one, as the Qeetrix logo docs prescribe.
 * This replaces the theme-adaptive `QeetLogoMark` that `@qeetrix/ui` 1.x
 * exported from `@qeetrix/ui/brand`, which 2.x removed.
 */
export function QeetMark({ height, className, ...label }: QeetMarkProps) {
  return (
    <>
      <QeetLogo height={height} className={cn("dark:hidden", className)} {...label} />
      <QeetLogo
        variant="dark"
        height={height}
        className={cn("hidden dark:block", className)}
        {...label}
      />
    </>
  );
}
