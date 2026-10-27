import { Skeleton } from "@qeetrix/react";

/** The band's place while its numbers load, so the header doesn't jump when they arrive. */
export function BandPlaceholder({ cells = 4 }: { cells?: 3 | 4 }) {
  return (
    <div className={cells === 3 ? "ppl-band is-three" : "ppl-band"} aria-hidden="true">
      {Array.from({ length: cells }, (_, cell) => cell).map((cell) => (
        <div key={cell} className="ppl-cell">
          <Skeleton className="ppl-skeleton-label" />
          <Skeleton className="ppl-skeleton-value" />
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
