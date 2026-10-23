import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import {
  DownloadIcon,
  FileTextIcon,
  FolderOpenIcon,
  LayersIcon,
  NetworkIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { ListToolbar, SortHeader } from "@/shared/components/data-table";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useListView } from "@/shared/hooks/use-list-view";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";

import { type Group, useDeleteGroup, useGroups } from "../api/groups";
import { EditGroupSheet } from "./edit-group-sheet";
import { GroupHierarchy } from "./group-hierarchy";
import { GroupMembersSheet } from "./group-members-sheet";
import { GroupTemplatesDialog } from "./group-templates-dialog";
import { ImportGroupsDialog } from "./import-groups-dialog";
import { NewGroupSheet } from "./new-group-sheet";

// The create sheet's "initial members" picker shows the tenant's first page of users.
const PICKER_PAGE = { limit: 100, offset: 0 };

const groupCsvColumns: CsvColumn<Group>[] = [
  { header: "id", value: (g) => g.id },
  { header: "name", value: (g) => g.name },
  { header: "description", value: (g) => g.description },
  { header: "parent_id", value: (g) => g.parent_id },
  { header: "created_at", value: (g) => g.created_at },
];

/** Renders the groups list: KPIs, filters, the hierarchy view and the create, import and edit sheets. */
export function GroupsPage() {
  const { t } = useTranslation("groups");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const canWrite = useCapabilities().can("group.write");
  const [creating, setCreating] = useCreateIntent(canWrite);
  const [view, setView] = useState<"list" | "tree">("list");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groupsQ = useGroups();

  const items = groupsQ.data?.items ?? [];

  // Candidates for the create drawer's "initial members" picker. Loaded here
  // rather than inside the drawer so opening it doesn't stall on a fetch.
  const usersQ = useQuery({
    ...userQueries.list(tenantId, PICKER_PAGE),
    enabled: !!tenantId && canWrite,
  });
  const directoryUsers = usersQ.data?.items ?? [];
  const lv = useListView(items, {
    searchFields: (g) => [g.name, g.description],
    filterFields: { scope: (g) => (g.parent_id ? "nested" : "top-level") },
    sortFields: { name: (g) => g.name, created: (g) => g.created_at },
  });
  const rows = lv.view;
  const denseCls = lv.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : undefined;

  const deleteM = useDeleteGroup();
  // Deleting a group ends the access its members inherited through it.
  const remove = (g: Group) =>
    runSensitive({
      confirm: {
        title: t("confirm.delete", { name: g.name }),
        description: t("confirm.deleteDescription"),
        confirmLabel: t("confirm.deleteLabel"),
        tone: "destructive",
      },
      actionLabel: t("confirm.deleteAction"),
      run: () => deleteM.mutateAsync(g.id),
    }).catch(settleSensitiveAction);

  const topLevel = items.filter((g) => !g.parent_id).length;
  const nested = items.length - topLevel;
  const assigned = items.reduce((n, g) => n + (g.member_count ?? 0), 0);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("list.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => groupsQ.refetch()}
              disabled={groupsQ.isFetching}
            >
              <RefreshCwIcon className={groupsQ.isFetching ? "animate-spin" : ""} />
              {t("list.refresh")}
            </Button>
            {canWrite ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon /> {t("list.new")}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GroupKpi
          icon={<UsersRoundIcon />}
          tone="bg-primary/10 text-primary"
          label={t("kpis.total")}
          value={items.length}
          hint={items.length === 0 ? t("kpis.totalHintEmpty") : t("kpis.totalHint")}
          loading={groupsQ.isPending}
        />
        <GroupKpi
          icon={<NetworkIcon />}
          tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          label={t("kpis.topLevel")}
          value={topLevel}
          hint={t("kpis.topLevelHint")}
          loading={groupsQ.isPending}
        />
        <GroupKpi
          icon={<LayersIcon />}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          label={t("kpis.nested")}
          value={nested}
          hint={t("kpis.nestedHint")}
          loading={groupsQ.isPending}
        />
        <GroupKpi
          icon={<UserIcon />}
          tone="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          label={t("kpis.members")}
          value={assigned}
          hint={t("kpis.membersHint")}
          loading={groupsQ.isPending}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base">{t("list.title")}</CardTitle>
            <CardDescription>{t("list.subtitle")}</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={view === "tree" ? "default" : "outline"}
              onClick={() => setView(view === "tree" ? "list" : "tree")}
            >
              <NetworkIcon /> {t("list.hierarchyView")}
            </Button>
            {canWrite ? (
              <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
                <FileTextIcon /> {t("list.templates")}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={rows.length === 0}
              onClick={() => exportToCsv("groups", rows, groupCsvColumns)}
            >
              <DownloadIcon /> {t("list.export")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ListToolbar
            search={lv.search}
            onSearchChange={lv.setSearch}
            searchPlaceholder={t("list.searchPlaceholder")}
            filters={[
              {
                id: "scope",
                label: t("list.filters.scope.label"),
                value: lv.filters.scope ?? "",
                options: [
                  { label: t("list.filters.scope.topLevel"), value: "top-level" },
                  { label: t("list.filters.scope.nested"), value: "nested" },
                ],
                onChange: (v) => lv.setFilter("scope", v),
              },
            ]}
            columns={[
              { id: "description", label: t("list.columns.description") },
              { id: "parent", label: t("list.columns.parent") },
              { id: "created", label: t("list.columns.created") },
            ]}
            isColumnVisible={lv.isVisible}
            onToggleColumn={lv.toggleColumn}
            density={lv.density}
            onDensityChange={lv.setDensity}
            onExport={(fmt) =>
              fmt === "csv"
                ? exportToCsv("groups", rows, groupCsvColumns)
                : exportToJson("groups", rows)
            }
            exportDisabled={rows.length === 0}
            hasActiveFilters={lv.hasActiveFilters}
            onClear={lv.clear}
          />
          {items.length === 0 && !groupsQ.isPending && !groupsQ.isError ? (
            <GroupsEmptyState
              canWrite={canWrite}
              onCreate={() => setCreating(true)}
              onImport={() => setImportOpen(true)}
            />
          ) : view === "tree" && rows.length > 0 ? (
            <GroupHierarchy groups={rows} />
          ) : (
            <DataState
              isLoading={groupsQ.isLoading}
              isError={groupsQ.isError}
              error={groupsQ.error}
              isEmpty={rows.length === 0}
              emptyIcon={UsersRoundIcon}
              emptyTitle={lv.hasActiveFilters ? t("list.emptyFiltered") : t("list.empty")}
              skeletonRows={3}
            >
              <Table className={denseCls}>
                <TableHeader>
                  <TableRow>
                    <SortHeader columnKey="name" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("list.columns.name")}
                    </SortHeader>
                    {lv.isVisible("description") && (
                      <TableHead>{t("list.columns.description")}</TableHead>
                    )}
                    {lv.isVisible("parent") && <TableHead>{t("list.columns.parent")}</TableHead>}
                    {lv.isVisible("created") && (
                      <SortHeader columnKey="created" sort={lv.sort} onToggle={lv.toggleSort}>
                        {t("list.columns.created")}
                      </SortHeader>
                    )}
                    <TableHead className="text-right">{t("list.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/groups/$groupId"
                          params={{ groupId: g.id }}
                          className="hover:underline"
                        >
                          {g.name}
                        </Link>
                      </TableCell>
                      {lv.isVisible("description") && (
                        <TableCell className="text-muted-foreground">
                          {g.description || "—"}
                        </TableCell>
                      )}
                      {lv.isVisible("parent") && (
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {g.parent_id ? `${g.parent_id.slice(0, 8)}…` : "—"}
                        </TableCell>
                      )}
                      {lv.isVisible("created") && (
                        <TableCell>
                          <TimeSince value={g.created_at} />
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setExpandedId(g.id)}>
                          <UserPlusIcon /> {t("table.members")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>
                          <PencilIcon /> {t("table.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteM.isPending}
                          onClick={() => remove(g)}
                        >
                          <TrashIcon /> {t("table.delete")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataState>
          )}
        </CardContent>
      </Card>

      {items.length === 0 && !groupsQ.isPending && !groupsQ.isError ? (
        <GroupsFeatureBlurbs />
      ) : null}

      <NewGroupSheet
        open={creating}
        onOpenChange={setCreating}
        groups={items}
        users={directoryUsers}
      />
      <GroupTemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      <ImportGroupsDialog open={importOpen} onOpenChange={setImportOpen} />

      <EditGroupSheet group={editing} onOpenChange={(o) => !o && setEditing(null)} groups={items} />

      {expandedId && (
        <GroupMembersSheet
          groupId={expandedId}
          groupName={groupsQ.data?.items?.find((g) => g.id === expandedId)?.name ?? ""}
          onClose={() => setExpandedId(null)}
        />
      )}
    </div>
  );
}

function GroupKpi({
  icon,
  tone,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
  hint: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone} [&_svg]:size-4.5`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-heading text-2xl font-semibold tabular-nums">
          {loading ? "—" : value.toLocaleString(formatLocale())}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function GroupsEmptyState({
  canWrite,
  onCreate,
  onImport,
}: {
  canWrite: boolean;
  onCreate: () => void;
  onImport: () => void;
}) {
  const { t } = useTranslation("groups");
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-28 place-items-center rounded-full bg-primary/5">
        <FolderOpenIcon className="size-12 text-primary" strokeWidth={1.25} />
      </span>
      <h3 className="mt-6 font-heading text-xl font-semibold">{t("emptyState.title")}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {t("emptyState.description")}
      </p>
      {canWrite ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onCreate}>
            <PlusIcon /> {t("emptyState.createFirst")}
          </Button>
          <Button variant="outline" onClick={onImport}>
            <UploadIcon /> {t("emptyState.import")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function GroupsFeatureBlurbs() {
  const { t } = useTranslation("groups");
  const features = [
    { id: "hierarchy", icon: <NetworkIcon /> },
    { id: "access", icon: <ShieldCheckIcon /> },
    { id: "scale", icon: <UsersRoundIcon /> },
  ] as const;

  return (
    <div className="grid gap-6 rounded-xl border bg-card p-6 sm:grid-cols-3">
      {features.map((f) => (
        <div key={f.id} className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4.5">
            {f.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{t(`emptyState.features.${f.id}.title`)}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t(`emptyState.features.${f.id}.detail`)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
