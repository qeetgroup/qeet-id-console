import { QeetLogo } from "@qeetrix/icons";
import { cn } from "@qeetrix/ui";

type QeetMarkProps = {
  height: number; // px; the mark is square, so also its width
  className?: string;
  "aria-label"?: string; // names the mark; without it the mark is decorative
};

/**
 * Renders the Qeet mark for the console theme. `@qeetrix/icons` logos are images that can't see
 * the theme, so both files render and the `dark:` variant shows one, as the logo docs prescribe.
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
