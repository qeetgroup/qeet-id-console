import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  ArrowLeftIcon,
  FolderIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type GroupRole,
  useGrantGroupRole,
  useGroupRoles,
  useRevokeGroupRole,
  useRoles,
} from "@/modules/authorization";
import { DataState } from "@/platform/components/data-state";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { initials } from "@/shared/utils/initials";

import { useGroupMembers, useGroups } from "../api/groups";

/** Renders one group: its details, members and the roles its members inherit. */
export function GroupDetailPage({ groupId }: { groupId: string }) {
  const { t } = useTranslation("groups");
  // There is no GET /v1/groups/{id}, so read the tenant's list and pick the group locally.
  const listQ = useGroups();
  const membersQ = useGroupMembers(groupId);

  const group = listQ.data?.items?.find((g) => g.id === groupId);
  const members = membersQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Link
          to="/groups"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" /> {t("detail.back")}
        </Link>
      </div>

      <DataState
        isLoading={listQ.isLoading}
        isError={listQ.isError}
        error={listQ.error}
        isEmpty={listQ.isSuccess && !group}
        emptyIcon={FolderIcon}
        emptyTitle={t("detail.notFound", { id: `${groupId.slice(0, 8)}…` })}
        emptyDescription={t("detail.notFoundDescription")}
      >
        {group && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">{group.name}</CardTitle>
                <CardDescription>
                  {group.description || (
                    <span className="italic text-muted-foreground/70">
                      {t("detail.noDescription")}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t("detail.stats.members")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {membersQ.isLoading ? "—" : members.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("detail.stats.created")}</p>
                  <TimeSince value={group.created_at} className="font-mono text-xs" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("detail.metadata.title")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("detail.metadata.groupId")}</p>
                  <p className="font-mono text-xs">{group.id}</p>
                </div>
                {group.parent_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.metadata.parentGroup")}
                    </p>
                    <Link
                      to="/groups/$groupId"
                      params={{ groupId: group.parent_id }}
                      className="font-mono text-xs underline"
                    >
                      {group.parent_id.slice(0, 8)}…
                    </Link>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">{t("detail.metadata.tenant")}</p>
                  <p className="font-mono text-xs">{group.tenant_id}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{t("detail.members.title")}</CardTitle>
                  <CardDescription>{t("detail.members.description")}</CardDescription>
                </div>
                <Link to="/groups" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {t("detail.members.manage")}
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <DataState
                  isLoading={membersQ.isLoading}
                  isError={membersQ.isError}
                  error={membersQ.error}
                  isEmpty={members.length === 0}
                  emptyIcon={UsersIcon}
                  emptyTitle={t("detail.members.empty")}
                  skeletonRows={3}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("detail.members.columns.user")}</TableHead>
                        <TableHead>{t("detail.members.columns.email")}</TableHead>
                        <TableHead className="text-right">
                          {t("detail.members.columns.userId")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7">
                                <AvatarFallback className="text-[10px]">
                                  {initials(m.display_name || m.email)}
                                </AvatarFallback>
                              </Avatar>
                              <Link
                                to="/users/$userId"
                                params={{ userId: m.user_id }}
                                className="text-sm font-medium hover:underline"
                              >
                                {m.display_name || m.email}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-xs text-muted-foreground">
                              {m.user_id.slice(0, 8)}…
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DataState>
              </CardContent>
            </Card>

            <div className="lg:col-span-3">
              <GroupRolesCard groupId={group.id} />
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}

function GroupRolesCard({ groupId }: { groupId: string }) {
  const { t } = useTranslation("rbac");
  const rolesQ = useGroupRoles(groupId);
  const allRolesQ = useRoles();
  const grantM = useGrantGroupRole(groupId);
  const revokeM = useRevokeGroupRole(groupId);
  const runSensitive = useSensitiveAction();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  // Granting and removing a group's role are step-up gated: they change what every member can do.
  const grant = (roleId: string) =>
    runSensitive({
      actionLabel: t("groupRoles.grantAction").toLowerCase(),
      run: () => grantM.mutateAsync(roleId),
    })
      .then(() => setSelectedRoleId(""))
      .catch(settleSensitiveAction);

  const revoke = (role: GroupRole) =>
    runSensitive({
      confirm: {
        title: t("groupRoles.revokeTitle"),
        description: t("groupRoles.revokeDescriptionPlain", { name: role.name }),
        confirmLabel: t("common:actions.remove"),
        tone: "destructive",
      },
      actionLabel: t("groupRoles.revokeAction").toLowerCase(),
      run: () => revokeM.mutateAsync(role.role_id),
    }).catch(settleSensitiveAction);

  const granted = rolesQ.data?.items ?? [];
  const grantedIds = new Set(granted.map((r) => r.role_id));
  const grantable = (allRolesQ.data?.items ?? []).filter((r) => !grantedIds.has(r.id));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{t("groupRoles.title")}</CardTitle>
          <CardDescription>{t("groupRoles.description")}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedRoleId} onValueChange={(v) => v && setSelectedRoleId(v)}>
            <SelectTrigger className="w-55" aria-label={t("groupRoles.selectAriaLabel")}>
              <SelectValue placeholder={t("groupRoles.addPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {grantable.length === 0 ? (
                <SelectItem value="__none" disabled>
                  {allRolesQ.isLoading ? t("groupRoles.loadingRoles") : t("groupRoles.allGranted")}
                </SelectItem>
              ) : (
                grantable.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selectedRoleId || grantM.isPending}
            onClick={() => selectedRoleId && grant(selectedRoleId)}
          >
            {grantM.isPending && <LoaderCircleIcon className="animate-spin" />}
            {t("groupRoles.addRole")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <DataState
          isLoading={rolesQ.isLoading}
          isError={rolesQ.isError}
          error={rolesQ.error}
          isEmpty={granted.length === 0}
          emptyIcon={ShieldCheckIcon}
          emptyTitle={t("groupRoles.emptyTitle")}
          emptyDescription={t("groupRoles.emptyDescription")}
          skeletonRows={2}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("groupRoles.roleHeader")}</TableHead>
                <TableHead>{t("groupRoles.grantedHeader")}</TableHead>
                <TableHead className="text-right">{t("groupRoles.actionsHeader")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {granted.map((r) => (
                <TableRow key={r.role_id}>
                  <TableCell>
                    <Badge variant="secondary">{r.name}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <TimeSince value={r.granted_at} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(r)}
                      disabled={revokeM.isPending}
                    >
                      {t("common:actions.remove")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataState>
      </CardContent>
    </Card>
  );
}
