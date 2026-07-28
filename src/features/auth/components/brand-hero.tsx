import { cn } from "@qeetrix/ui";
import { QeetLogoMark } from "@qeetrix/ui/brand";
import { ShieldCheckIcon } from "lucide-react";
import type * as React from "react";

// Compliance signals shown on the auth panel. These mirror the console's
// Security → Compliance sections (SOC 2 / ISO 27001 / GDPR).
const TRUST_BADGES = ["SOC 2", "ISO 27001", "GDPR"] as const;

export function BrandHero({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative hidden overflow-hidden bg-muted md:block dark:brightness-[0.85]",
        className,
      )}
      {...props}
    >
      {/* Gradient + soft decorative circles (pure backdrop). */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 800 1000"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="brand-hero-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="100%" stopColor="#262626" />
          </linearGradient>
        </defs>
        <rect width="800" height="1000" fill="url(#brand-hero-gradient)" />
        <g fill="#ffffff" fillOpacity="0.06">
          <circle cx="120" cy="160" r="220" />
          <circle cx="680" cy="820" r="260" />
        </g>
      </svg>

      {/* Brand lockup: Qeet mark + wordmark + tagline, centered. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <QeetLogoMark variant="on-dark" size={72} title="Qeet ID" />
        <div className="space-y-1.5">
          <p className="font-heading text-2xl font-semibold tracking-tight text-white">Qeet ID</p>
          <p className="text-sm text-white/70">Passkeys-first identity &amp; access</p>
        </div>
      </div>

      {/* Trust / compliance badges pinned to the bottom. */}
      <div className="absolute inset-x-0 bottom-8 flex flex-wrap items-center justify-center gap-2 px-6">
        {TRUST_BADGES.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm"
          >
            <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
