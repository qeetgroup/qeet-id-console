import { useId } from "react";

/** Theme-aware, server-rendered folded glass. No WebGL or downloaded artwork. */
export function AuthBackground() {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <div className="auth-background" aria-hidden="true">
      <svg
        viewBox="0 0 1365 656"
        preserveAspectRatio="none"
        className="auth-artwork"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0.8">
            <stop stopColor="var(--auth-glass-shadow)" />
            <stop offset="0.48" stopColor="var(--auth-glass)" />
            <stop offset="0.9" stopColor="var(--auth-glass-edge)" />
            <stop offset="1" stopColor="var(--auth-glass-shadow)" />
          </linearGradient>
          <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2="0.4">
            <stop stopColor="var(--auth-glass-shadow)" />
            <stop offset="0.76" stopColor="var(--auth-glass)" />
            <stop offset="0.94" stopColor="var(--auth-glass-edge)" />
            <stop offset="1" stopColor="var(--auth-glass)" />
          </linearGradient>
          <linearGradient id={`${id}-ribbon`} x1="0.15" y1="0" x2="0.72" y2="1">
            <stop stopColor="var(--auth-ribbon-light)" />
            <stop offset="0.12" stopColor="var(--auth-ribbon-amber)" />
            <stop offset="0.42" stopColor="var(--auth-glass)" />
            <stop offset="0.72" stopColor="var(--auth-glass-shadow)" />
            <stop offset="1" stopColor="var(--auth-glass)" />
          </linearGradient>
          <linearGradient id={`${id}-sweep`} x1="0.35" y1="0" x2="0.5" y2="1">
            <stop stopColor="var(--auth-ribbon-light)" />
            <stop offset="0.15" stopColor="var(--auth-ribbon-amber)" stopOpacity="0.45" />
            <stop offset="0.85" stopColor="var(--auth-glass)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient
            id={`${id}-right`}
            gradientUnits="userSpaceOnUse"
            x1="1255"
            y1="206"
            x2="1200"
            y2="261"
          >
            <stop stopColor="var(--auth-background)" stopOpacity="0.1" />
            <stop offset="0.35" stopColor="var(--auth-glass)" stopOpacity="0.45" />
            <stop offset="0.8" stopColor="var(--auth-ribbon-amber)" />
            <stop offset="1" stopColor="var(--auth-ribbon-light)" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0.2">
            <stop stopColor="var(--auth-ribbon-light)" stopOpacity="0.5" />
            <stop offset="0.36" stopColor="var(--auth-ribbon-light)" />
            <stop offset="0.72" stopColor="#ff8d25" />
            <stop offset="1" stopColor="var(--auth-glass-edge)" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop stopColor="#ff870e" stopOpacity="0.65" />
            <stop offset="0.38" stopColor="#ff830a" stopOpacity="0.2" />
            <stop offset="1" stopColor="#ff830a" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-soft`} x="-50%" y="-100%" width="200%" height="300%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* Architectural seams leave a quiet area behind the hero and form. */}
        <g fill="none" strokeWidth="0.7">
          <path d="M181 -30V365Q181 371 186 376L349 538H531L650 656" stroke="var(--auth-seam)" />
          <path d="M464 -5 1112 656M904 -5l461 438" stroke="var(--auth-seam-soft)" />
          <path d="M1016 -20v199l184 184v313M1320 -10v132l-120 119" stroke="var(--auth-seam)" />
          <path d="M1320 122v547M181 139h230" stroke="var(--auth-seam-soft)" />
        </g>

        {/* Folded glass along the left edge. */}
        <path d="M-85 -35 62 124V371L-85 222Z" fill={paint("glass")} />
        <path d="M-74 -28 49 108V342L-74 212Z" fill={paint("fold")} />
        <path d="M49 108v233M62 124v247" fill="none" stroke={paint("edge")} />
        <ellipse cx="60" cy="332" rx="85" ry="152" fill={paint("glow")} opacity="0.42" />
        <path d="M-80 183 126 399Q139 412 139 430V582L-80 545Z" fill={paint("glass")} />
        <path d="M-85 192 116 401Q128 414 128 434V562L-85 539Z" fill={paint("fold")} />
        <path
          d="M-80 183 126 399Q139 412 139 430V582"
          fill="none"
          stroke="var(--auth-glass-edge)"
          strokeWidth="0.8"
        />

        {/* The illuminated diagonal on the right echoes the lower ribbon. */}
        <path d="M1016 -102H1320V299L1280 340 1016 77Z" fill={paint("right")} />
        <path
          d="m1016 77 264 263 40-41"
          fill="none"
          stroke="#ff8d25"
          strokeWidth="10"
          opacity="0.5"
          filter={paint("soft")}
        />
        <path d="m1016 77 264 263 40-41" fill="none" stroke={paint("edge")} />
        <path d="m1200 260 165 167v229h-165Z" fill={paint("fold")} opacity="0.26" />
        <path d="m1200 260 165 167M1018 558l302-302" fill="none" stroke="var(--auth-seam)" />

        {/* A broad, curved ribbon, not a flat orange gradient. */}
        <path d="M-160 378C60 462 327 498 539 658H-160Z" fill={paint("ribbon")} />
        <path
          d="M-160 378C60 462 327 498 539 658"
          fill="none"
          stroke="#ff931f"
          strokeWidth="10"
          opacity="0.32"
          filter={paint("soft")}
        />
        <path d="M-160 378C60 462 327 498 539 658" fill="none" stroke={paint("edge")} />
        <ellipse cx="133" cy="506" rx="126" ry="115" fill={paint("glow")} opacity="0.7" />
        <path d="M-50 630C64 571 176 516 265 539S397 598 440 658H-50Z" fill={paint("sweep")} />
        <path
          d="M-50 630C64 571 176 516 265 539S397 598 440 658"
          fill="none"
          stroke={paint("edge")}
          strokeWidth="0.8"
        />
      </svg>
      <span className="auth-card-orb auth-background-orb" />
    </div>
  );
}
