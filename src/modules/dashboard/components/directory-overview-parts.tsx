import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Skeleton,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  CirclePlusIcon,
  type IconProps,
  LightbulbIcon,
  NetworkIcon,
  RefreshCwIcon,
  ServerIcon,
} from "@qeetrix/icons";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type QueryState = {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
};

export const ACTION_CLASS =
  "h-9 gap-2 rounded-md px-3.5 text-xs font-medium shadow-xs pointer-coarse:min-h-11";
export const TEXT_LINK_CLASS =
  "inline-flex min-h-8 items-center gap-2 rounded-sm text-xs font-medium text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:min-h-11";
export const FOOTER_LINK_CLASS =
  "inline-flex min-h-8 items-center gap-2 rounded-sm text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&_svg]:size-4";

type DirectoryArea = "users" | "organizations" | "groups" | "directories";

export function DirectoryCard({
  area,
  icon: Icon,
  href,
  children,
  footer,
  queries,
}: {
  area: DirectoryArea;
  icon: ComponentType<IconProps<"outline">>;
  href: string;
  children: ReactNode;
  footer: ReactNode;
  queries: QueryState[];
}) {
  const { t } = useTranslation("dashboard");
  const failed = queries.filter((query) => query.isError);
  const isRefreshing = queries.some((query) => query.isFetching);

  return (
    <article
      aria-labelledby={`directory-${area}-title`}
      className="@container/area relative flex min-w-0 flex-col rounded-lg border border-border/65 bg-card/90 px-5 pt-5 pb-3 shadow-[0_2px_12px_color-mix(in_oklab,var(--foreground)_2%,transparent)] transition-colors duration-200 hover:border-border dark:border-border/80 dark:bg-linear-to-br dark:from-card/85 dark:to-card/40 dark:shadow-none"
    >
      <header className="relative flex min-h-14 items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-primary/5 bg-primary/8 text-primary dark:border-primary/15 dark:bg-primary/10">
          <Icon className="size-6" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2
            id={`directory-${area}-title`}
            className="font-heading text-lg leading-6 font-semibold"
          >
            {t(`directory.${area}.title`)}
          </h2>
          <p className="mt-1 max-w-80 text-xs leading-5 text-muted-foreground">
            {t(`directory.${area}.description`)}
          </p>
        </div>
        <Link
          to={href as never}
          aria-label={t(`directory.${area}.view`)}
          className={cn(TEXT_LINK_CLASS, "relative z-10 shrink-0 self-start")}
        >
          <span className="hidden @min-[420px]/area:inline">{t(`directory.${area}.view`)}</span>
          <ArrowRightIcon className="hidden size-4 @min-[420px]/area:block" aria-hidden="true" />
          <ChevronRightIcon
            className="size-4 text-muted-foreground @min-[420px]/area:hidden"
            aria-hidden="true"
          />
        </Link>
      </header>

      <dl className="my-5 grid min-h-12 grid-cols-3 divide-x divide-border/75">{children}</dl>

      {failed.length > 0 ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <span className="text-muted-foreground">{t("directory.loadError")}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={isRefreshing}
            onClick={() => failed.forEach((query) => void query.refetch())}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <RefreshCwIcon className={cn("size-3.5", isRefreshing && "motion-safe:animate-spin")} />
            {t("directory.retry")}
          </Button>
        </div>
      ) : null}

      <footer className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/75 pt-2">
        {footer}
      </footer>
    </article>
  );
}

export function DirectoryMetric({
  label,
  value,
  query,
  restricted = false,
  tone,
  badge = false,
  detail,
}: {
  label: string;
  value?: string | number;
  query?: QueryState;
  restricted?: boolean;
  tone?: "warning" | "deleted" | "success";
  badge?: boolean;
  detail?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const unavailable = query?.isError || value === undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1 px-3 first:ps-0 last:pe-0 @min-[420px]/area:px-5">
      <dt className="order-2 text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "order-1 flex min-h-7 items-center font-heading text-[22px] leading-7 font-semibold tabular-nums",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
          tone === "deleted" && "text-muted-foreground dark:text-red-400",
          tone === "success" && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {restricted ? (
          <span className="font-sans text-xs font-normal text-muted-foreground">
            {t("directory.restricted")}
          </span>
        ) : query?.isPending ? (
          <Skeleton
            role="status"
            aria-label={t("directory.loadingMetric", { label })}
            className="h-6 w-12"
          />
        ) : unavailable ? (
          <span className="font-sans text-xs font-normal text-muted-foreground">
            {t("directory.unavailable")}
          </span>
        ) : (
          <span
            className={cn(
              "min-w-0 wrap-break-word",
              typeof value === "string" && "font-sans text-sm leading-5",
              badge &&
                "rounded-md border border-emerald-500/10 bg-emerald-500/10 px-3 py-0.5 text-xs text-emerald-700 capitalize dark:border-emerald-400/10 dark:text-emerald-400",
            )}
          >
            {typeof value === "number" ? value.toLocaleString(i18n.resolvedLanguage) : value}
          </span>
        )}
      </dd>
      {detail && !query?.isPending && !unavailable ? (
        <dd className="order-3 text-[11px] leading-4 text-muted-foreground">{detail}</dd>
      ) : null}
    </div>
  );
}

export function ConnectionMenu({ primary = false }: { primary?: boolean }) {
  const { t } = useTranslation("dashboard");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={primary ? "default" : "ghost"}
            className={primary ? ACTION_CLASS : FOOTER_LINK_CLASS}
          />
        }
      >
        {primary ? <NetworkIcon className="size-4" /> : <CirclePlusIcon className="size-4" />}
        {t("directory.actions.addConnection")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("directory.actions.connectionType")}</DropdownMenuLabel>
          <DropdownMenuItem render={<Link to="/auth/connections/scim" />}>
            <NetworkIcon /> SCIM
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/auth/connections/ldap" />}>
            <ServerIcon /> LDAP / AD
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DirectoryFooter() {
  const { t } = useTranslation("dashboard");
  return (
    <aside className="relative mt-2 flex flex-wrap items-center gap-x-5 gap-y-4 overflow-hidden rounded-lg border border-primary/15 bg-primary/3 px-5 py-4 dark:border-primary/20 dark:bg-primary/5">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <LightbulbIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="relative min-w-0 flex-1 basis-52">
        <h2 className="font-heading text-sm font-semibold">{t("directory.footer.title")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t("directory.footer.description")}
        </p>
      </div>
      <a
        href="https://docs.id.qeet.in"
        target="_blank"
        rel="noreferrer"
        className={cn(TEXT_LINK_CLASS, "relative shrink-0 gap-2 bg-primary/8 px-3 py-1")}
      >
        {t("directory.footer.documentation")}
        <ArrowRightIcon className="size-4" aria-hidden="true" />
      </a>
    </aside>
  );
}
