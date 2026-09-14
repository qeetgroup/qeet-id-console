import { BookOpenIcon, Code2Icon, HelpCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type HelpLink = {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
};

/**
 * The three-up "where to go next" footer under the applications table. Shown
 * regardless of whether the list is empty — it is the same set of pointers an
 * operator wants before and after registering their first client.
 */
export function ApplicationHelpLinks() {
  const { t } = useTranslation("oidc");

  const links: HelpLink[] = [
    {
      href: "https://docs.qeet.in/qeet-id/applications",
      icon: <BookOpenIcon />,
      title: t("help.docsTitle"),
      description: t("help.docsDescription"),
    },
    {
      href: "https://docs.id.qeet.in/docs/sdks",
      icon: <Code2Icon />,
      title: t("help.examplesTitle"),
      description: t("help.examplesDescription"),
    },
    {
      href: "https://id.qeet.in/contact",
      icon: <HelpCircleIcon />,
      title: t("help.supportTitle"),
      description: t("help.supportDescription"),
    },
  ];

  return (
    <div className="grid gap-3 border-t p-4 sm:grid-cols-3 sm:gap-4">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-lg p-2 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
            {l.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium group-hover:underline">{l.title}</span>
            <span className="block text-xs leading-5 text-muted-foreground">{l.description}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
