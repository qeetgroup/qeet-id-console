import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  CircleXIcon,
  Clock3Icon,
  FunnelIcon,
  LinkIcon,
  NetworkIcon,
  PlusIcon,
  SearchIcon,
  ServerIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useUserStats } from "@/modules/users";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useDirectoryConnections } from "../api/directory";
import {
  coveragePercent,
  type DirectoryConnection,
  summarizeConnectionHealth,
} from "../directory-model";
import { ConnectionRow } from "./connections-page-row";
import {
  DIRECTORY_ACTION,
  DIRECTORY_PAGE,
  DIRECTORY_PANEL,
  DirectoryDonut,
  DirectoryPanel,
  DirectoryQueryError,
  DirectoryStat,
} from "./directory-ui";

export function ConnectionsPage() {
  const access = useCapabilities();
  const query = useDirectoryConnections();
  const users = useUserStats(access.can("user.read"));
  return (
    <ConnectionsView
      connections={query.isError ? undefined : query.data}
      loading={query.isPending}
      error={query.isError}
      busy={query.isFetching}
      retry={query.refetch}
      canWrite={access.can("connection.write")}
      totalUsers={access.can("user.read") && !users.isError ? users.data?.total : undefined}
    />
  );
}

const SKELETON_COLUMNS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function ConnectionsView({
  connections,
  loading,
  error,
  busy,
  retry,
  canWrite,
  totalUsers,
}: {
  connections?: DirectoryConnection[];
  loading: boolean;
  error: boolean;
  busy: boolean;
  retry: () => unknown;
  canWrite: boolean;
  totalUsers?: number;
}) {
  const { t } = useTranslation("directory");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "scim" | "ldap">("all");
  const records = connections ?? [];
  const summary = summarizeConnectionHealth(records);
  const matching = records.filter(
    (connection) =>
      (type === "all" || connection.type === type) &&
      [connection.name, connection.reference, connection.type, connection.serverUrl].some((value) =>
        value?.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  const scimUsers = records.find((connection) => connection.type === "scim")?.userCount ?? null;
  const coverage = coveragePercent(scimUsers, totalUsers);
  const number = (value: number) => value.toLocaleString(formatLocale());
  const share = (count: number | null) =>
    count == null || summary.total === 0
      ? t("directory.connectionsPage.awaiting")
      : t("directory.connectionsPage.percent", {
          percent: Math.round((count / summary.total) * 100),
        });

  return (
    <div className={DIRECTORY_PAGE}>
      <PageHeader
        title={t("directory.connectionsPage.title")}
        description={t("directory.connectionsPage.description")}
        actions={canWrite ? <AddConnection /> : undefined}
      />
      {error ? <DirectoryQueryError retry={retry} busy={busy} /> : null}

      <section
        aria-label={t("directory.connectionsPage.summary")}
        className="grid gap-3 @min-[460px]/directory-page:grid-cols-2 @min-[900px]/directory-page:grid-cols-5"
      >
        <DirectoryStat
          label={t("directory.connectionsPage.total")}
          value={connections ? number(summary.total) : null}
          detail={t("directory.connectionsPage.configuredSources")}
          icon={LinkIcon}
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.connectionsPage.healthy")}
          value={summary.healthy}
          detail={share(summary.healthy)}
          icon={CircleCheckIcon}
          tone="success"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.connectionsPage.warnings")}
          value={summary.warnings}
          detail={share(summary.warnings)}
          icon={TriangleAlertIcon}
          tone="warning"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.connectionsPage.failed")}
          value={summary.failed}
          detail={share(summary.failed)}
          icon={CircleXIcon}
          tone="danger"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.connectionsPage.lastSync")}
          value={
            summary.lastSyncAt ? <TimeSince value={summary.lastSyncAt} className="text-sm" /> : null
          }
          detail={t("directory.connectionsPage.latestRun")}
          icon={Clock3Icon}
          tone="info"
          loading={loading}
        />
      </section>

      <section className={DIRECTORY_PANEL} aria-label={t("directory.connectionsPage.table")}>
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold">
            {t("directory.connectionsPage.table")}{" "}
            <span className="font-normal text-muted-foreground">({number(matching.length)})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={t("directory.connectionsPage.search")}
                placeholder={t("directory.connectionsPage.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-8 ps-8 text-xs"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" className={DIRECTORY_ACTION} />}
              >
                <FunnelIcon /> {t("directory.filter")}
                {type !== "all" ? " (1)" : ""}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t("directory.connectionsPage.type")}</DropdownMenuLabel>
                  {(["all", "scim", "ldap"] as const).map((value) => (
                    <DropdownMenuCheckboxItem
                      key={value}
                      checked={type === value}
                      onCheckedChange={() => setType(value)}
                    >
                      {value === "all"
                        ? t("directory.allTypes")
                        : value === "scim"
                          ? "SCIM"
                          : "LDAP / AD"}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="overflow-x-auto">
          <Table className="min-w-230 text-xs [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:text-[10px]">
            <TableHeader className="border-y border-border/70 bg-muted/25">
              <TableRow>
                {(
                  [
                    "name",
                    "type",
                    "environment",
                    "scope",
                    "status",
                    "lastSync",
                    "synced",
                    "actions",
                  ] as const
                ).map((column) => (
                  <TableHead key={column}>{t(`directory.connectionsPage.${column}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? [0, 1, 2].map((row) => (
                    <TableRow key={row}>
                      {SKELETON_COLUMNS.map((column) => (
                        <TableCell key={column}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : matching.map((connection) => (
                    <ConnectionRow key={connection.id} connection={connection} />
                  ))}
              {!loading && matching.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <NetworkIcon className="mx-auto mb-3 size-6 text-muted-foreground" />
                    <p className="font-medium">
                      {t(
                        error
                          ? "directory.loadError"
                          : search || type !== "all"
                            ? "directory.noResults"
                            : "directory.connectionsPage.empty",
                      )}
                    </p>
                    {search || type !== "all" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setType("all");
                        }}
                      >
                        {t("directory.clearFilters")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-3 @min-[780px]/directory-page:grid-cols-3">
        <DirectoryPanel
          title={t("directory.connectionsPage.healthTitle")}
          description={t("directory.connectionsPage.healthDescription")}
        >
          <div className="flex flex-wrap items-center gap-5">
            <DirectoryDonut
              value={
                summary.healthy == null
                  ? "--"
                  : `${Math.round((summary.healthy / Math.max(1, summary.total)) * 100)}%`
              }
              label={t("directory.connectionsPage.healthy")}
              values={[
                {
                  label: t("directory.connectionsPage.healthy"),
                  count: summary.healthy ?? 0,
                  color: "var(--color-emerald-500)",
                },
                {
                  label: t("directory.connectionsPage.warnings"),
                  count: summary.warnings ?? 0,
                  color: "var(--color-amber-500)",
                },
                {
                  label: t("directory.connectionsPage.failed"),
                  count: summary.failed ?? 0,
                  color: "var(--color-rose-500)",
                },
                {
                  label: t("directory.connectionsPage.unknown"),
                  count: summary.unknown,
                  color: "var(--muted)",
                },
              ]}
            />
            <dl className="min-w-28 flex-1 space-y-2 text-xs">
              {(["healthy", "warnings", "failed", "unknown"] as const).map((status) => (
                <div key={status} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t(`directory.connectionsPage.${status}`)}
                  </dt>
                  <dd className="font-medium tabular-nums">{summary[status] ?? "--"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </DirectoryPanel>
        <DirectoryPanel
          title={t("directory.connectionsPage.coverageTitle")}
          description={t("directory.connectionsPage.coverageDescription")}
        >
          <div className="space-y-5 pt-2">
            <div>
              <div className="mb-2 flex justify-between gap-2 text-xs">
                <span>{t("directory.users.title")}</span>
                <span className="text-muted-foreground">
                  {scimUsers == null || totalUsers == null
                    ? t("directory.notReported")
                    : `${number(scimUsers)} / ${number(totalUsers)}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <progress
                  className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
                  aria-label={t("directory.connectionsPage.userCoverage")}
                  value={coverage ?? 0}
                  max={100}
                />
                <span className="text-xs tabular-nums">
                  {coverage == null ? "--" : `${coverage}%`}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span>{t("directory.groups.title")}</span>
                <span className="text-muted-foreground">{t("directory.notReported")}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted" />
              <p className="mt-2 text-[10px] text-muted-foreground">
                {t("directory.connectionsPage.groupCoverage")}
              </p>
            </div>
          </div>
        </DirectoryPanel>
        <DirectoryPanel title={t("directory.connectionsPage.eventsTitle")}>
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
            <Clock3Icon className="size-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {t("directory.connectionsPage.noEvents")}
            </p>
          </div>
        </DirectoryPanel>
      </div>
    </div>
  );
}

function AddConnection() {
  const { t } = useTranslation("directory");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className={DIRECTORY_ACTION} />}>
        <PlusIcon /> {t("directory.connectionsPage.add")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link to="/auth/connections/scim" />}>
          <NetworkIcon /> SCIM
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/auth/connections/ldap" />}>
          <ServerIcon /> LDAP / AD
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
