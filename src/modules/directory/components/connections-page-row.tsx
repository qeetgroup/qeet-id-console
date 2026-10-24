import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TableCell,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, EllipsisIcon, NetworkIcon, ServerIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";

import type { DirectoryConnection } from "../directory-model";
import { DirectoryStatus } from "./directory-ui";

/** One connection: its source, scope, health, last sync and synced counts. */
export function ConnectionRow({ connection }: { connection: DirectoryConnection }) {
  const { t } = useTranslation("directory");
  const destination =
    connection.type === "scim" ? "/auth/connections/scim" : "/auth/connections/ldap";
  const tone =
    connection.health === "failed"
      ? "danger"
      : connection.health === "warning"
        ? "warning"
        : connection.health === "healthy"
          ? "success"
          : "neutral";
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              connection.type === "scim"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
            )}
          >
            {connection.type === "scim" ? (
              <NetworkIcon className="size-4" />
            ) : (
              <ServerIcon className="size-4" />
            )}
          </span>
          <div>
            <Link to={destination} className="font-medium hover:text-primary">
              {connection.name}
            </Link>
            <p
              className="mt-0.5 max-w-44 truncate text-[10px] text-muted-foreground"
              title={connection.reference}
            >
              {connection.reference}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
          {connection.type === "scim" ? "SCIM" : "LDAP / AD"}
        </span>
      </TableCell>
      <TableCell>
        {connection.environment ? (
          <span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-700 dark:text-emerald-400">
            {connection.environment}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("directory.notSet")}</span>
        )}
      </TableCell>
      <TableCell>
        <p>{t(`directory.connectionsPage.${connection.scope}`)}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {t(
            connection.type === "scim"
              ? "directory.connectionsPage.push"
              : "directory.connectionsPage.jit",
          )}
        </p>
      </TableCell>
      <TableCell>
        <DirectoryStatus
          label={t(
            `directory.connectionsPage.${connection.health === "unknown" ? connection.status : connection.health}`,
          )}
          tone={tone}
        />
      </TableCell>
      <TableCell>
        {connection.lastSyncAt ? (
          <>
            <TimeSince value={connection.lastSyncAt} />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {new Date(connection.lastSyncAt).toLocaleString(formatLocale())}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">{t("directory.notReported")}</span>
        )}
      </TableCell>
      <TableCell>
        <p>
          {connection.userCount == null
            ? "--"
            : connection.userCount.toLocaleString(formatLocale())}{" "}
          {t("directory.connectionsPage.users")}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {connection.groupCount ?? "--"} {t("directory.connectionsPage.groups")}
        </p>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("directory.connectionsPage.rowActions", { name: connection.name })}
                className="size-7"
              />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link to={destination} />}>
              <ArrowRightIcon /> {t("directory.connectionsPage.view")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
