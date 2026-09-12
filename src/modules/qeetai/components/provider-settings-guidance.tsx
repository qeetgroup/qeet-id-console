import { Anthropic, MicrosoftAzure, Openai } from "@thesvg/react";
import {
  BookOpenIcon,
  ChartNoAxesColumnIcon,
  CloudIcon,
  ExternalLinkIcon,
  NetworkIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { QeetAIProvider } from "../api/qeetai";

export function ProviderLogo({ provider }: { provider: QeetAIProvider }) {
  return (
    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center [&_svg]:size-4">
      {provider === "anthropic" ? <Anthropic className="invert dark:invert-0" /> : null}
      {provider === "openai" ? <Openai className="invert dark:invert-0" /> : null}
      {provider === "azure" ? <MicrosoftAzure /> : null}
    </span>
  );
}

export function ProviderSettingsGuidance({ fallback }: { fallback?: boolean }) {
  const { t } = useTranslation("settings");
  const resourceLink =
    "mt-1 inline-flex min-h-6 items-center gap-1.5 rounded-sm text-[11px] font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";

  return (
    <aside
      aria-label={t("qeetAI.guide.label")}
      className="min-w-0 self-start rounded-lg border border-border/70 bg-card/90 px-4 py-3 shadow-xs dark:bg-card/70 dark:shadow-none"
    >
      <section aria-labelledby="qeet-ai-how-heading">
        <h2
          id="qeet-ai-how-heading"
          className="flex items-center gap-2 font-heading text-sm font-semibold"
        >
          <BookOpenIcon className="size-4 shrink-0" aria-hidden="true" />
          {t("qeetAI.guide.how")}
        </h2>
        <ol className="mt-3 space-y-3">
          {["key", "account", "organization"].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-xs leading-4 font-semibold">
                  {t(`qeetAI.guide.${step}.title`)}
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {t(`qeetAI.guide.${step}.description`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="qeet-ai-security-heading"
        className="mt-3 border-t border-border/70 pt-3"
      >
        <h2
          id="qeet-ai-security-heading"
          className="flex items-center gap-2 font-heading text-sm font-semibold"
        >
          <ShieldCheckIcon className="size-4 shrink-0" aria-hidden="true" />
          {t("qeetAI.guide.security.title")}
        </h2>
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
          {t("qeetAI.guide.security.description")}
        </p>
        <a
          href="https://id.qeet.in/security"
          target="_blank"
          rel="noreferrer"
          className={resourceLink}
        >
          {t("qeetAI.learnMore")} <ExternalLinkIcon className="size-3" aria-hidden="true" />
        </a>
      </section>

      <section
        aria-labelledby="qeet-ai-providers-heading"
        className="mt-3 border-t border-border/70 pt-3"
      >
        <h2
          id="qeet-ai-providers-heading"
          className="flex items-center gap-2 font-heading text-sm font-semibold"
        >
          <NetworkIcon className="size-4 shrink-0" aria-hidden="true" />
          {t("qeetAI.guide.providers")}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {[
            { value: "anthropic" as const, label: "Anthropic" },
            { value: "openai" as const, label: "OpenAI" },
            { value: "azure" as const, label: "Azure" },
          ].map((provider) => (
            <li
              key={provider.value}
              className="flex items-center gap-1.5 rounded-md border border-border/80 px-2 py-1 text-[11px]"
            >
              <ProviderLogo provider={provider.value} /> {provider.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5 rounded-md border border-border/80 px-2 py-1 text-[11px]">
            <CloudIcon className="size-4" aria-hidden="true" /> {t("qeetAI.guide.compatible")}
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="qeet-ai-billing-heading"
        className="mt-3 border-t border-border/70 pt-3"
      >
        <h2
          id="qeet-ai-billing-heading"
          className="flex items-center gap-2 font-heading text-sm font-semibold"
        >
          <ChartNoAxesColumnIcon className="size-4 shrink-0" aria-hidden="true" />
          {t("qeetAI.guide.billing.title")}
        </h2>
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
          {t("qeetAI.guide.billing.description")}
        </p>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          {t(
            fallback === undefined
              ? "qeetAI.guide.fallbackUnknown"
              : fallback
                ? "qeetAI.guide.fallback"
                : "qeetAI.guide.noFallback",
          )}
        </p>
      </section>
    </aside>
  );
}
