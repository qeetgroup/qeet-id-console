import { Skeleton } from "@qeetrix/react";

/** A Directories band's place while its numbers load, so the header doesn't jump when they arrive. */
export function BandPlaceholder() {
  return (
    <div className="ppl-band" aria-hidden="true">
      {[0, 1, 2, 3].map((cell) => (
        <div key={cell} className="ppl-cell">
          <Skeleton className="ppl-skeleton-label" />
          <Skeleton className="ppl-skeleton-value" />
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
