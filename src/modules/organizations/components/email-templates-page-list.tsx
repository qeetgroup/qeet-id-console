import { cn } from "@qeetrix/ui";
import {
  type IconProps,
  KeyRoundIcon,
  LinkIcon,
  MailIcon,
  ShieldCheckIcon,
  UserRoundPlusIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { EmailTemplate, EmailTemplateInput } from "../api/email-templates";
import { emailTemplateInput } from "../email-template-model";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ICONS: Record<string, ComponentType<IconProps<"outline">>> = {
  verify_email: MailIcon,
  password_reset: KeyRoundIcon,
  magic_link: LinkIcon,
  invite: UserRoundPlusIcon,
  mfa_otp: ShieldCheckIcon,
};

/** The template picker, marking each template that has unsaved edits. */
export function EmailTemplateList({
  id,
  templates,
  selectedKey,
  drafts,
  saved,
  disabled,
  onSelect,
}: {
  id: string;
  templates: EmailTemplate[];
  selectedKey: string;
  drafts: Record<string, EmailTemplateInput>;
  saved: Record<string, EmailTemplate>;
  disabled: boolean;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation("organizations");
  return (
    <section className={cn(SURFACE, "p-3")} aria-labelledby={`${id}-templates`}>
      <h2 id={`${id}-templates`} className="font-heading text-sm font-semibold">
        {t("emails.list")}{" "}
        <span className="font-normal text-muted-foreground">({templates.length})</span>
      </h2>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
        {t("emails.listDescription")}
      </p>
      <nav
        aria-label={t("emails.list")}
        className="mt-3 grid gap-1 @max-[639px]/emails:grid-cols-2"
      >
        {templates.map((item) => {
          const Icon = ICONS[item.key] ?? MailIcon;
          const active = item.key === selectedKey;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? "true" : undefined}
              disabled={disabled}
              onClick={() => onSelect(item.key)}
              className={cn(
                "flex min-w-0 cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring disabled:opacity-50",
                active ? "bg-primary/8 text-foreground" : "hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-md",
                  active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold leading-4">{item.name}</span>
                <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                  {item.description}
                </span>
                {drafts[item.key] &&
                  JSON.stringify(drafts[item.key]) !==
                    JSON.stringify(emailTemplateInput(saved[item.key] ?? item)) && (
                    <span className="mt-1 block text-[9px] font-medium text-primary">
                      {t("emails.unsaved")}
                    </span>
                  )}
              </span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
